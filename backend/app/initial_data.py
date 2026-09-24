import logging
from datetime import datetime, timezone, timedelta
from app.core.database import engine, SessionLocal, Base
from app.core.security import hash_password
from app.models.user import AdminUser
from app.models.application import ConnectedApplication
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.audit import IamAuditLog
from app.models.oauth import OAuthAuthorizationCode
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ciam.init")

def init_db():
    logger.info("Creating database tables if they do not exist...")
    Base.metadata.create_all(bind=engine)

    # Safe auto-migration for security columns in existing databases (Postgres & SQLite)
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        columns = [c["name"] for c in inspector.get_columns("central_iam_admins")]
        with engine.connect() as conn:
            if "failed_login_attempts" not in columns:
                conn.execute(text("ALTER TABLE central_iam_admins ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;"))
            if "locked_until" not in columns:
                conn.execute(text("ALTER TABLE central_iam_admins ADD COLUMN locked_until TIMESTAMP;"))
            conn.commit()
    except Exception as e:
        logger.debug("Auto-migration central_iam_admins notice: %s", e)

    db = SessionLocal()
    try:
        # 1. Seed Super Admin
        admin = db.query(AdminUser).filter(AdminUser.username == "admin").first()
        if not admin:
            admin = AdminUser(
                username="admin",
                hashed_password=hash_password("admin123"),
                full_name="Somchai N. (IT Security Lead)",
                email="admin.ciam@windowasia.com",
                role="SUPER_ADMIN",
                is_active=True
            )
            db.add(admin)
            logger.info("Created default admin user: admin / admin123")

        # 2. Seed Connected Applications (Real enterprise spokes)
        apps_data = [
            {
                "app_code": "irm",
                "app_name": "Incoming Raw Material (IRM)",
                "connector_type": "REST_API",
                "base_url": "https://irm.windowasia.com",
                "api_key": "sec_irm_mgmt_9a4f21e8d3b76c501e4a",
                "client_id": "irm-spoke-client",
                "client_secret": "sec_irm_oauth_secret_2026",
                "redirect_uris": "http://localhost:3000/portal/callback,http://localhost:3001/auth/callback,https://irm.windowasia.com/auth/callback",
                "sso_enabled": True,
                "health_status": "ONLINE",
                "latency_ms": 32
            },
            {
                "app_code": "qms",
                "app_name": "Quality Management System (QMS)",
                "connector_type": "REST_API",
                "base_url": "https://qms.windowasia.com",
                "api_key": "sec_qms_mgmt_f49b10398dc3a011ef",
                "client_id": "qms-spoke-client",
                "client_secret": "sec_qms_oauth_secret_2026",
                "redirect_uris": "http://localhost:3000/portal/callback,http://localhost:3002/auth/callback,https://qms.windowasia.com/auth/callback",
                "sso_enabled": True,
                "health_status": "ONLINE",
                "latency_ms": 28
            },
            {
                "app_code": "qol",
                "app_name": "QT Online",
                "connector_type": "REST_API",
                "base_url": "https://qol.windowasia.com",
                "api_key": "sec_qol_mgmt_7e1c8430a911bb",
                "client_id": "qol-spoke-client",
                "client_secret": "sec_qol_oauth_secret_2026",
                "redirect_uris": "http://localhost:3000/portal/callback,https://qol.windowasia.com/auth/callback",
                "sso_enabled": True,
                "health_status": "ONLINE",
                "latency_ms": 25
            },
            {
                "app_code": "sap_b1",
                "app_name": "SAP Business One (ERP)",
                "connector_type": "SAP_B1",
                "base_url": "https://sapb1.waapps.net",
                "api_key": "sec_sap_b1_mgmt_8b2e1f409c3d",
                "sap_company_db": "WA_PROD",
                "sap_username": "ciam_reader",
                "sap_password": "",
                "client_id": "sap-b1-spoke-client",
                "client_secret": "sec_sap_b1_oauth_secret_2026",
                "redirect_uris": "http://localhost:3000/portal/callback",
                "sso_enabled": False,
                "health_status": "ONLINE",
                "latency_ms": 22
            },
            {
                "app_code": "ad",
                "app_name": "Active Directory (DC Gateway)",
                "connector_type": "AD_PROXY",
                "base_url": "http://172.18.0.1:3100",
                "api_key": "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823",
                "client_id": "CIAM",
                "client_secret": "aa0a27f191208cbe6543c88636d18ff40b9bea422dfc51d426bf920ca54c1823",
                "sap_company_db": "157.173.219.153",
                "ad_allow_status_patch": False,
                "sso_enabled": False,
                "health_status": "ONLINE",
                "latency_ms": 246
            },
            {
                "app_code": "m365",
                "app_name": "Microsoft 365 (Entra ID & Exchange)",
                "connector_type": "M365",
                "base_url": "https://graph.microsoft.com",
                "api_key": settings.M365_CLIENT_SECRET,
                "client_id": settings.M365_CLIENT_ID,
                "client_secret": settings.M365_CLIENT_SECRET,
                "sap_company_db": settings.M365_TENANT_ID,
                "sso_enabled": False,
                "health_status": "ONLINE",
                "latency_ms": 115
            }
        ]

        app_objs = {}
        for item in apps_data:
            app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == item["app_code"]).first()
            if not app:
                app = ConnectedApplication(
                    app_code=item["app_code"],
                    app_name=item["app_name"],
                    connector_type=item["connector_type"],
                    base_url=item.get("base_url"),
                    api_key=item.get("api_key"),
                    sap_company_db=item.get("sap_company_db"),
                    sap_username=item.get("sap_username"),
                    sap_password=item.get("sap_password"),
                    ad_allow_status_patch=item.get("ad_allow_status_patch", False),
                    client_id=item.get("client_id"),
                    client_secret=item.get("client_secret"),
                    redirect_uris=item.get("redirect_uris"),
                    sso_enabled=item.get("sso_enabled", True),
                    health_status=item["health_status"],
                    latency_ms=item["latency_ms"],
                    last_health_check_at=datetime.now(timezone.utc),
                    last_sync_at=datetime.now(timezone.utc)
                )
                db.add(app)
                db.flush()
                logger.info("Seeded connected application: %s (%s)", app.app_name, app.connector_type)
            else:
                # Update client credentials if not already populated
                if not app.client_id:
                    app.client_id = item.get("client_id")
                    app.client_secret = item.get("client_secret")
                    app.redirect_uris = item.get("redirect_uris")
                    app.sso_enabled = item.get("sso_enabled", True)
                if item.get("sap_company_db") and not app.sap_company_db:
                    app.sap_company_db = item.get("sap_company_db")
                    app.sap_username = item.get("sap_username")
                # Auto-upgrade AD configuration if holding old placeholder key
                if item["app_code"] == "ad":
                    if not app.api_key or app.api_key == "mgmt_ciam_key_9a88b1c0d2e3f4a5":
                        app.api_key = item.get("api_key")
                    if not app.client_secret or app.client_secret == "mgmt_ciam_key_9a88b1c0d2e3f4a5":
                        app.client_secret = item.get("client_secret")
                    if not app.client_id:
                        app.client_id = "CIAM"
                db.flush()
            app_objs[item["app_code"]] = app

        # 3. Seed Real Master Identities from Active Directory & IRM
        now = datetime.now(timezone.utc)
        real_identities = [
            {
                "username": "Patcha.S",
                "full_name": "Patcha Suksawas",
                "email": "patcha.s@windowasia.com",
                "department": "Purchasing",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "irm", "role": "PU User", "active": True}
                ]
            },
            {
                "username": "Pinyada.S",
                "full_name": "Pinyada Rungrattanaporn",
                "email": "pinyada.s@windowasia.com",
                "department": "Purchasing",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "irm", "role": "PU User", "active": True}
                ]
            },
            {
                "username": "Chaiwat.N",
                "full_name": "Chaiwat Nilawan",
                "email": "chaiwat.n@windowasia.com",
                "department": "Purchasing",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "irm", "role": "PU User", "active": True}
                ]
            },
            {
                "username": "Apichai.P",
                "full_name": "Apichai Parimanara",
                "email": "apichai.p@windowasia.com",
                "department": "Purchasing",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "irm", "role": "PU User", "active": True}
                ]
            },
            {
                "username": "Hermes.N",
                "full_name": "Hermess Nilawan",
                "email": "hermes.n@windowasia.com",
                "department": "Warehouse",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "irm", "role": "WH User", "active": True}
                ]
            }
        ]

        for item in real_identities:
            ident = db.query(MasterIdentity).filter(MasterIdentity.username == item["username"]).first()
            if not ident:
                ident = MasterIdentity(
                    username=item["username"],
                    full_name=item["full_name"],
                    email=item.get("email"),
                    department=item.get("department"),
                    is_active_in_ad=item["is_active_in_ad"],
                    last_login_ad_at=now - timedelta(hours=2)
                )
                db.add(ident)
                db.flush()

                for map_spec in item.get("mappings", []):
                    app_obj = app_objs.get(map_spec["app"])
                    if app_obj:
                        mapping = AppAccountMapping(
                            identity_id=ident.id,
                            application_id=app_obj.id,
                            app_username=ident.username,
                            app_group_name=map_spec["role"],
                            is_active_in_app=map_spec["active"],
                            last_sync_status="IN_SYNC"
                        )
                        db.add(mapping)
                logger.info("Seeded real master identity: %s (%s)", ident.full_name, ident.username)

        db.commit()
        logger.info("Database initialization and seeding complete with real data!")
    except Exception as e:
        db.rollback()
        logger.error("Database initialization failed: %s", e)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
