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
from app.models.setting import SystemSetting
from sqlalchemy import func
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
            if "telegram_id" not in columns:
                conn.execute(text("ALTER TABLE central_iam_admins ADD COLUMN telegram_id VARCHAR(100);"))

            # Safe auto-migration for master_identities
            identity_columns = [c["name"] for c in inspector.get_columns("master_identities")]
            if "telegram_id" not in identity_columns:
                conn.execute(text("ALTER TABLE master_identities ADD COLUMN telegram_id VARCHAR(100);"))
            if "is_approved_exception" not in identity_columns:
                conn.execute(text("ALTER TABLE master_identities ADD COLUMN is_approved_exception BOOLEAN DEFAULT FALSE;"))
            if "exception_type" not in identity_columns:
                conn.execute(text("ALTER TABLE master_identities ADD COLUMN exception_type VARCHAR(50);"))
            if "exception_reason" not in identity_columns:
                conn.execute(text("ALTER TABLE master_identities ADD COLUMN exception_reason VARCHAR(255);"))
            if "exception_approved_by" not in identity_columns:
                conn.execute(text("ALTER TABLE master_identities ADD COLUMN exception_approved_by VARCHAR(100);"))
            if "exception_approved_at" not in identity_columns:
                conn.execute(text("ALTER TABLE master_identities ADD COLUMN exception_approved_at TIMESTAMP;"))

            # Safe auto-migration for app_account_mappings
            mapping_columns = [c["name"] for c in inspector.get_columns("app_account_mappings")]
            if "is_approved_exception" not in mapping_columns:
                conn.execute(text("ALTER TABLE app_account_mappings ADD COLUMN is_approved_exception BOOLEAN DEFAULT FALSE;"))
            if "exception_type" not in mapping_columns:
                conn.execute(text("ALTER TABLE app_account_mappings ADD COLUMN exception_type VARCHAR(50);"))
            if "exception_reason" not in mapping_columns:
                conn.execute(text("ALTER TABLE app_account_mappings ADD COLUMN exception_reason VARCHAR(255);"))
            if "exception_approved_by" not in mapping_columns:
                conn.execute(text("ALTER TABLE app_account_mappings ADD COLUMN exception_approved_by VARCHAR(100);"))
            if "exception_approved_at" not in mapping_columns:
                conn.execute(text("ALTER TABLE app_account_mappings ADD COLUMN exception_approved_at TIMESTAMP;"))
            if "exception_expires_at" not in mapping_columns:
                conn.execute(text("ALTER TABLE app_account_mappings ADD COLUMN exception_expires_at TIMESTAMP;"))

            # Safe auto-migration for connected_applications
            app_columns = [c["name"] for c in inspector.get_columns("connected_applications")]
            if "spoke_sso_status" not in app_columns:
                conn.execute(text("ALTER TABLE connected_applications ADD COLUMN spoke_sso_status VARCHAR(50) DEFAULT 'UNKNOWN';"))
            if "network_policy" not in app_columns:
                conn.execute(text("ALTER TABLE connected_applications ADD COLUMN network_policy VARCHAR(50) DEFAULT 'ANYWHERE';"))
            if "vpn_restriction_mode" not in app_columns:
                conn.execute(text("ALTER TABLE connected_applications ADD COLUMN vpn_restriction_mode VARCHAR(50) DEFAULT 'HIDE';"))
            if "allowed_network_cidrs" not in app_columns:
                conn.execute(text("ALTER TABLE connected_applications ADD COLUMN allowed_network_cidrs VARCHAR(500);"))
            if "portal_launch_url" not in app_columns:
                conn.execute(text("ALTER TABLE connected_applications ADD COLUMN portal_launch_url VARCHAR(500);"))

            # Safe auto-migration for oauth_authorization_codes
            if inspector.has_table("oauth_authorization_codes"):
                oauth_columns = [c["name"] for c in inspector.get_columns("oauth_authorization_codes")]
                if "nonce" not in oauth_columns:
                    conn.execute(text("ALTER TABLE oauth_authorization_codes ADD COLUMN nonce VARCHAR(255);"))

            if not inspector.has_table("spoke_pending_commands"):
                conn.execute(text("""
                    CREATE TABLE spoke_pending_commands (
                        id SERIAL PRIMARY KEY,
                        command_id VARCHAR(50) UNIQUE NOT NULL,
                        app_code VARCHAR(50) NOT NULL,
                        action VARCHAR(50) NOT NULL,
                        username VARCHAR(100) NOT NULL,
                        reason VARCHAR(255),
                        status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
                        issued_by VARCHAR(100) DEFAULT 'Central-IAM' NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        executed_at TIMESTAMP WITH TIME ZONE,
                        result_message VARCHAR(500)
                    );
                    CREATE INDEX IF NOT EXISTS idx_spoke_cmd_app_code ON spoke_pending_commands(app_code);
                    CREATE INDEX IF NOT EXISTS idx_spoke_cmd_status ON spoke_pending_commands(status);
                """))

            conn.commit()
    except Exception as e:
        logger.debug("Auto-migration notice: %s", e)


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
                "redirect_uris": "https://irm.windowasia.com/auth/callback,http://localhost:3001/auth/callback,http://localhost:3000/portal/callback",
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
                "redirect_uris": "https://qms.windowasia.com/auth/callback,http://localhost:3002/auth/callback,http://localhost:3000/portal/callback",
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
                "redirect_uris": "https://qol.windowasia.com/auth/callback,http://localhost:3000/portal/callback",
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
            },
            {
                "app_code": "mtpulse",
                "app_name": "MT Pulse",
                "connector_type": "SSO_ONLY",
                "base_url": "https://wa-mtpulse.wa.net",
                "client_id": "mtpulse-spoke-client",
                "client_secret": "sec_mtpulse_oauth_secret_2026",
                "portal_launch_url": "https://wa-mtpulse.wa.net/auth/start",
                "redirect_uris": "https://wa-mtpulse.wa.net/auth/callback,https://wa-mtpulse.wa.net/api/auth/callback,http://localhost:3000/portal/callback",
                "sso_enabled": True,
                "health_status": "ONLINE",
                "latency_ms": 30
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
                    portal_launch_url=item.get("portal_launch_url"),
                    sso_enabled=item.get("sso_enabled", True),
                    health_status=item["health_status"],
                    latency_ms=item["latency_ms"],
                    last_health_check_at=datetime.now(timezone.utc),
                    last_sync_at=datetime.now(timezone.utc)
                )
                db.add(app)
                db.flush()
            else:
                # Auto-heal legacy 192.168 base_urls on existing applications
                if app.base_url and "192.168." in app.base_url:
                    if app.app_code == "ad":
                        app.base_url = "http://172.18.0.1:3100"
                    else:
                        app.base_url = app.base_url.replace("192.168.12.11", "172.18.0.1")
                    logger.info("Auto-healed legacy 192.168 IP for %s to %s", app.app_code, app.base_url)
                # Update client credentials if not already populated
                if not app.client_id:
                    app.client_id = item.get("client_id")
                    app.client_secret = item.get("client_secret")
                    app.redirect_uris = item.get("redirect_uris")
                    app.portal_launch_url = item.get("portal_launch_url")
                    app.sso_enabled = item.get("sso_enabled", True)
                elif item.get("redirect_uris"):
                    target_redirects = item["redirect_uris"]
                    current_redirects = app.redirect_uris or ""
                    if current_redirects.startswith("http://localhost:3000/portal/callback") or current_redirects != target_redirects:
                        app.redirect_uris = target_redirects
                        logger.info("Updated redirect_uris for %s to prioritize spoke callbacks: %s", app.app_code, target_redirects)
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
                # Auto-upgrade MTPulse redirect_uris and portal_launch_url
                if item["app_code"] == "mtpulse":
                    needed_mt = [
                        "https://wa-mtpulse.wa.net/auth/callback",
                        "https://wa-mtpulse.wa.net/api/auth/callback",
                        "http://localhost:3000/portal/callback"
                    ]
                    cur_uris = [u.strip() for u in (app.redirect_uris or "").split(",") if u.strip()]
                    for nu in needed_mt:
                        if nu not in cur_uris:
                            cur_uris.append(nu)
                    app.redirect_uris = ",".join(cur_uris)
                    app.portal_launch_url = "https://wa-mtpulse.wa.net/auth/start"
                    if not app.client_id:
                        app.client_id = "mtpulse-spoke-client"
                    if not app.base_url:
                        app.base_url = "https://wa-mtpulse.wa.net"
                    app.sso_enabled = True
                    app.network_policy = "VPN_ONLY"
                    app.vpn_restriction_mode = "LOCK_WITH_BANNER"
                    logger.info("Ensured MTPulse portal_launch_url configured: %s, network_policy: VPN_ONLY, vpn_restriction_mode: LOCK_WITH_BANNER", app.portal_launch_url)
                db.flush()
            app_objs[item["app_code"]] = app


        # Auto-heal AD master identities and spoke account mappings:
        # Recover corporate identities wrongly set to inactive in AD due to 04:00 AM sync-absence bug
        ad_app_obj = app_objs.get("ad")
        offboarded_usernames = set()
        try:
            offboard_logs = db.query(IamAuditLog).filter(
                IamAuditLog.action_type == "OFFBOARD",
                IamAuditLog.status == "SUCCESS"
            ).all()
            for l in offboard_logs:
                if l.target_username:
                    offboarded_usernames.add(l.target_username.strip().lower())
        except Exception as e:
            logger.warning("Could not query offboard audit logs: %s", e)

        corporate_depts = (
            "sale", "sales", "purchasing", "pu", "it", "administrator", "admin",
            "accounting", "hr", "executive", "management", "qa", "warehouse",
            "m365", "m365 user", "general", "user", "office"
        )
        corrupted_ad_identities = db.query(MasterIdentity).filter(MasterIdentity.is_active_in_ad == False).all()
        restored_count = 0
        now = datetime.now(timezone.utc)
        for cid in corrupted_ad_identities:
            u_low = (cid.username or "").strip().lower()
            if u_low in offboarded_usernames or u_low == "pinyada.s":
                continue  # Legitimately offboarded via Central-IAM or local IRM-only account

            dept_low = (cid.department or "").strip().lower()
            email_val = (cid.email or "").strip().lower()
            has_corp_email = "@windowasia.com" in email_val
            has_corp_dept = any(cd in dept_low for cd in corporate_depts) if dept_low else False
            is_ad_format = len(u_low.split(".")) == 2 and len(u_low.split(".")[1]) <= 2
            has_active_spoke = any(m.is_active_in_app for m in (cid.accounts or []))

            # A true corporate employee is recognized if:
            # 1. They have a corporate department (Sale, IT, HR, etc.) OR
            # 2. Their username follows standard AD naming convention (Firstname.L) OR
            # 3. They have a corporate email (@windowasia.com) OR
            # 4. They have an AD GUID OR
            # 5. They have active accounts in corporate spoke applications (QOL, IRM, M365, SAP B1, MTPulse)
            is_corporate = (
                has_corp_dept
                or is_ad_format
                or has_corp_email
                or cid.ad_guid
                or has_active_spoke
            )

            if is_corporate:
                cid.is_active_in_ad = True
                if not cid.email:
                    cid.email = f"{u_low}@windowasia.com"
                restored_count += 1
                if ad_app_obj:
                    ad_m = db.query(AppAccountMapping).filter(
                        AppAccountMapping.application_id == ad_app_obj.id,
                        (AppAccountMapping.identity_id == cid.id) |
                        (func.lower(AppAccountMapping.app_username) == cid.username.lower())
                    ).first()
                    if ad_m:
                        ad_m.is_active_in_app = True
                        ad_m.last_sync_status = "IN_SYNC"
                    else:
                        ad_m = AppAccountMapping(
                            identity_id=cid.id,
                            application_id=ad_app_obj.id,
                            app_username=cid.username,
                            app_group_name="Domain Users",
                            is_active_in_app=True,
                            last_sync_status="IN_SYNC",
                            created_at=now
                        )
                        db.add(ad_m)

        if restored_count > 0:
            db.flush()
            logger.info("Auto-healed %d corporate identities to Active in AD (including QOL, M365, Sales)", restored_count)

        # Ensure Pinyada.S (local spoke account in IRM) is treated as Local Acc, not AD
        local_ident = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == "pinyada.s").first()
        if local_ident:
            local_ident.is_active_in_ad = False
            local_ident.ad_guid = None
            local_ident.employee_id = None
            local_ident.last_login_ad_at = None
            if ad_app_obj:
                db.query(AppAccountMapping).filter(
                    AppAccountMapping.identity_id == local_ident.id,
                    AppAccountMapping.application_id == ad_app_obj.id
                ).delete()
            db.flush()

        # Prune duplicate AppAccountMapping records for the same (identity_id, application_id)
        duplicate_groups = (
            db.query(AppAccountMapping.identity_id, AppAccountMapping.application_id, func.count(AppAccountMapping.id))
            .group_by(AppAccountMapping.identity_id, AppAccountMapping.application_id)
            .having(func.count(AppAccountMapping.id) > 1)
            .all()
        )
        for ident_id, app_id, count in duplicate_groups:
            records = (
                db.query(AppAccountMapping)
                .filter(AppAccountMapping.identity_id == ident_id, AppAccountMapping.application_id == app_id)
                .order_by(AppAccountMapping.is_active_in_app.desc(), AppAccountMapping.id.desc())
                .all()
            )
            for redundant in records[1:]:
                db.delete(redundant)
        db.flush()

        # Synchronize remaining AD spoke account mappings to match MasterIdentity AD status
        if ad_app_obj:
            ad_mappings = db.query(AppAccountMapping).filter(AppAccountMapping.application_id == ad_app_obj.id).all()
            for m in ad_mappings:
                if m.identity and m.is_active_in_app != m.identity.is_active_in_ad:
                    m.is_active_in_app = m.identity.is_active_in_ad
            db.flush()

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
                    {"app": "irm", "role": "PU User", "active": True},
                    {"app": "sap_b1", "role": "SAP B1 User", "active": True}
                ]
            },
            {
                "username": "pinyada.r",
                "full_name": "Pinyada Rungrattanaporn",
                "email": "pinyada.r@windowasia.com",
                "department": "Purchasing",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "irm", "role": "PU User", "active": True},
                    {"app": "sap_b1", "role": "SAP B1 User", "active": True}
                ]
            },
            {
                "username": "Chaiwat.N",
                "full_name": "Chaiwat Nilawan",
                "email": "chaiwat.n@windowasia.com",
                "department": "Purchasing",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "irm", "role": "PU User", "active": True},
                    {"app": "sap_b1", "role": "SAP B1 Superuser", "active": True}
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
                "username": "Praewwalee.K",
                "full_name": "Praewwalee Khunthong",
                "email": "praewwalee.k@windowasia.com",
                "department": "Purchasing",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "irm", "role": "PU User", "active": True}
                ]
            },
            {
                "username": "Ronnakorn.P",
                "full_name": "Ronnakorn Pinwiset",
                "email": "ronnakorn.p@windowasia.com",
                "department": "IT",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "ad", "role": "Domain Users", "active": True},
                    {"app": "mtpulse", "role": "User", "active": True}
                ]
            },
            {
                "username": "Wimonpan.P",
                "full_name": "Wimonpan Promsuwan",
                "email": "wimonpan.p@windowasia.com",
                "department": "IT",
                "is_active_in_ad": True,
                "mappings": [
                    {"app": "ad", "role": "Domain Users", "active": True},
                    {"app": "mtpulse", "role": "User", "active": True}
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
            ident = db.query(MasterIdentity).filter(func.lower(MasterIdentity.username) == item["username"].lower()).first()
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
            else:
                ident.is_active_in_ad = item["is_active_in_ad"]
                for map_spec in item.get("mappings", []):
                    app_obj = app_objs.get(map_spec["app"])
                    if app_obj:
                        m = db.query(AppAccountMapping).filter(
                            AppAccountMapping.application_id == app_obj.id,
                            (AppAccountMapping.identity_id == ident.id) |
                            (func.lower(AppAccountMapping.app_username) == ident.username.lower())
                        ).first()
                        if not m:
                            m = AppAccountMapping(
                                identity_id=ident.id,
                                application_id=app_obj.id,
                                app_username=ident.username,
                                app_group_name=map_spec["role"],
                                is_active_in_app=map_spec["active"],
                                last_sync_status="IN_SYNC"
                            )
                            db.add(m)
                        else:
                            m.is_active_in_app = map_spec["active"]
                            m.last_sync_status = "IN_SYNC"

        # Auto-recover MTPulse commands for legitimate IT users
        from app.models.application import SpokePendingCommand
        import secrets
        # Delete any accidental DISABLE_USER commands
        db.query(SpokePendingCommand).filter(
            SpokePendingCommand.app_code == "mtpulse",
            SpokePendingCommand.action == "DISABLE_USER",
            func.lower(SpokePendingCommand.username).in_(["wimonpan.p", "winmonpan.p", "ronnakorn.p"])
        ).delete()
        # Ensure ENABLE_USER commands exist so MTPulse re-activates them on next heartbeat
        for legit_u in ["Wimonpan.P", "Ronnakorn.P"]:
            exists_cmd = db.query(SpokePendingCommand).filter(
                SpokePendingCommand.app_code == "mtpulse",
                SpokePendingCommand.action == "ENABLE_USER",
                func.lower(SpokePendingCommand.username) == legit_u.lower(),
                SpokePendingCommand.status.in_(["PENDING", "SENT"])
            ).first()
            if not exists_cmd:
                db.add(SpokePendingCommand(
                    command_id=f"cmd_recov_{secrets.token_hex(4)}",
                    app_code="mtpulse",
                    action="ENABLE_USER",
                    username=legit_u,
                    reason="Auto-Recovery: Re-enable legitimate corporate identity in MTPulse",
                    status="PENDING",
                    issued_by="System-AutoHeal"
                ))
 
        # 4. Seed Corporate VPN / Office Network Subnets
        vpn_setting = db.query(SystemSetting).filter(SystemSetting.setting_key == "corporate_vpn_networks").first()
        if not vpn_setting:
            vpn_setting = SystemSetting(
                setting_key="corporate_vpn_networks",
                setting_value={
                    "cidrs": [
                        "49.231.185.245/32",
                        "58.8.190.63/32",
                        "10.8.0.0/24",
                        "192.168.0.0/16",
                        "172.18.0.0/16",
                        "127.0.0.1/32",
                        "::1/128"
                    ]
                },
                description="Corporate Office Public IPs and OpenVPN Gateway CIDRs for On-Prem Spoke Security"
            )
            db.add(vpn_setting)
            logger.info("Seeded corporate_vpn_networks setting")

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
