import logging
from datetime import datetime, timezone, timedelta
from app.core.database import engine, SessionLocal, Base
from app.core.security import hash_password
from app.models.user import AdminUser
from app.models.application import ConnectedApplication
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.audit import IamAuditLog

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ciam.init")

def init_db():
    logger.info("Creating database tables if they do not exist...")
    Base.metadata.create_all(bind=engine)

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

        # 2. Seed Connected Applications
        apps_data = [
            {
                "app_code": "irm",
                "app_name": "Incoming Raw Material (IRM)",
                "connector_type": "REST_API",
                "base_url": "https://irm.windowasia.com",
                "api_key": "sec_irm_mgmt_a78f99201cb4e21a8d",
                "health_status": "ONLINE",
                "latency_ms": 32
            },
            {
                "app_code": "qms",
                "app_name": "Quality Management System (QMS)",
                "connector_type": "REST_API",
                "base_url": "https://qms.windowasia.com",
                "api_key": "sec_qms_mgmt_f49b10398dc3a011ef",
                "health_status": "ONLINE",
                "latency_ms": 28
            },
            {
                "app_code": "legacy_erp",
                "app_name": "Legacy ERP / SAP B1",
                "connector_type": "RPA_WORKER",
                "base_url": "http://erp-legacy.windowasia.internal",
                "rpa_adapter_name": "mock_legacy_erp",
                "health_status": "ONLINE",
                "latency_ms": 15
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
                    rpa_adapter_name=item.get("rpa_adapter_name"),
                    health_status=item["health_status"],
                    latency_ms=item["latency_ms"],
                    last_health_check_at=datetime.now(timezone.utc),
                    last_sync_at=datetime.now(timezone.utc)
                )
                db.add(app)
                db.flush()
                logger.info("Seeded connected application: %s (%s)", app.app_name, app.connector_type)
            app_objs[item["app_code"]] = app

        # 3. Seed Master Identities from Active Directory
        now = datetime.now(timezone.utc)
        identities_data = [
            {
                "employee_id": "WA-00101",
                "username": "somchai.p",
                "full_name": "Somchai Prasert",
                "email": "somchai.p@windowasia.com",
                "department": "Procurement & Raw Material",
                "telephone": "02-123-4501",
                "is_active_in_ad": True,
                "last_login_ad_at": now - timedelta(hours=2),
                "mappings": [
                    {"app": "irm", "role": "PU Manager", "active": True},
                    {"app": "legacy_erp", "role": "PO Approver", "active": True}
                ]
            },
            {
                "employee_id": "WA-00204",
                "username": "wilai.k",
                "full_name": "Wilai Kerdchok",
                "email": "wilai.k@windowasia.com",
                "department": "Quality Assurance",
                "telephone": "02-123-4520",
                "is_active_in_ad": True,
                "last_login_ad_at": now - timedelta(hours=5),
                "mappings": [
                    {"app": "qms", "role": "QA Lead Inspector", "active": True}
                ]
            },
            {
                "employee_id": "WA-00315",
                "username": "anuson.t",
                "full_name": "Anuson Thongdee",
                "email": "anuson.t@windowasia.com",
                "department": "Supply Chain & Warehouse",
                "telephone": "02-123-4588",
                "is_active_in_ad": True,
                "last_login_ad_at": now - timedelta(days=1),
                "mappings": [
                    {"app": "irm", "role": "Warehouse Supervisor", "active": True},
                    {"app": "qms", "role": "QA Inspector", "active": True},
                    {"app": "legacy_erp", "role": "Inventory Clerk", "active": True}
                ]
            },
            {
                # GHOST ACCOUNT TEST CASE: Employee left the company (Disabled in AD), but still Active in IRM & QMS!
                "employee_id": "WA-00409",
                "username": "kittisak.s",
                "full_name": "Kittisak Saetang",
                "email": "kittisak.s@windowasia.com",
                "department": "Warehouse Operations",
                "telephone": "02-123-4599",
                "is_active_in_ad": False, # Disabled in AD!
                "last_login_ad_at": now - timedelta(days=25),
                "mappings": [
                    {"app": "irm", "role": "Material Receiver", "active": True},
                    {"app": "qms", "role": "QA Auditor", "active": True}
                ]
            },
            {
                "employee_id": "WA-00522",
                "username": "siriporn.m",
                "full_name": "Siriporn Maneerat",
                "email": "siriporn.m@windowasia.com",
                "department": "Finance & Accounting",
                "telephone": "02-123-4611",
                "is_active_in_ad": True,
                "last_login_ad_at": now - timedelta(hours=8),
                "mappings": [
                    {"app": "legacy_erp", "role": "General Ledger Accountant", "active": True}
                ]
            }
        ]

        for item in identities_data:
            ident = db.query(MasterIdentity).filter(MasterIdentity.username == item["username"]).first()
            if not ident:
                ident = MasterIdentity(
                    employee_id=item["employee_id"],
                    username=item["username"],
                    full_name=item["full_name"],
                    email=item["email"],
                    department=item["department"],
                    telephone=item["telephone"],
                    is_active_in_ad=item["is_active_in_ad"],
                    last_login_ad_at=item["last_login_ad_at"]
                )
                db.add(ident)
                db.flush()

                # Add mappings
                for map_spec in item["mappings"]:
                    app_obj = app_objs.get(map_spec["app"])
                    if app_obj:
                        mapping = AppAccountMapping(
                            identity_id=ident.id,
                            application_id=app_obj.id,
                            app_username=ident.username,
                            app_user_id=f"{app_obj.app_code}_{ident.employee_id}",
                            app_group_name=map_spec["role"],
                            is_active_in_app=map_spec["active"],
                            last_sync_status="DISCREPANCY" if (not ident.is_active_in_ad and map_spec["active"]) else "IN_SYNC",
                            last_app_login_at=now - timedelta(days=2)
                        )
                        db.add(mapping)
                logger.info("Seeded master identity: %s (%s)", ident.full_name, ident.username)

        # 4. Seed sample audit logs
        log_count = db.query(IamAuditLog).count()
        if log_count == 0:
            db.add(IamAuditLog(
                actor_username="system_ad_sync",
                action_type="SYNC",
                target_username="ALL_USERS",
                affected_app_code="ad",
                execution_mode="AD_LDAP",
                reason="Scheduled nightly reconciliation sync with AD 192.168.12.11:3100",
                status="SUCCESS",
                created_at=now - timedelta(hours=6)
            ))
            db.add(IamAuditLog(
                actor_username="admin",
                action_type="ENABLE_USER",
                target_username="somchai.p",
                affected_app_code="irm",
                previous_status="DISABLED",
                new_status="ACTIVE",
                execution_mode="SYNC_REST",
                reason="Onboarding to PU Manager role",
                status="SUCCESS",
                created_at=now - timedelta(days=10)
            ))

        db.commit()
        logger.info("Database initialization and initial seeding complete!")
    except Exception as e:
        db.rollback()
        logger.error("Database initialization failed: %s", e)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
