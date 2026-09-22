import sys
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.application import ConnectedApplication
from app.core.config import settings

def seed_m365():
    db = SessionLocal()
    try:
        app = db.query(ConnectedApplication).filter(ConnectedApplication.app_code == "m365").first()
        if not app:
            app = ConnectedApplication(
                app_code="m365",
                app_name="Microsoft 365 (Entra ID & Exchange)",
                connector_type="M365",
                base_url="https://graph.microsoft.com",
                api_key=settings.M365_CLIENT_SECRET,
                client_id=settings.M365_CLIENT_ID,
                client_secret=settings.M365_CLIENT_SECRET,
                sap_company_db=settings.M365_TENANT_ID,
                sso_enabled=False,
                is_active=True,
                health_status="ONLINE",
                latency_ms=115,
                last_health_check_at=datetime.now(timezone.utc),
                last_sync_at=datetime.now(timezone.utc)
            )
            db.add(app)
            db.commit()
            print("Successfully inserted m365 into connected_applications!")
        else:
            app.connector_type = "M365"
            app.app_name = "Microsoft 365 (Entra ID & Exchange)"
            app.base_url = "https://graph.microsoft.com"
            app.api_key = settings.M365_CLIENT_SECRET
            app.client_id = settings.M365_CLIENT_ID
            app.client_secret = settings.M365_CLIENT_SECRET
            app.sap_company_db = settings.M365_TENANT_ID
            app.is_active = True
            db.commit()
            print("Successfully updated existing m365 application in database!")
    except Exception as e:
        print(f"Error seeding m365: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    seed_m365()
