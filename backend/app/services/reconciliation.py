from typing import List
from sqlalchemy.orm import Session
from app.models.identity import MasterIdentity
from app.models.mapping import AppAccountMapping
from app.models.application import ConnectedApplication
from app.schemas.dashboard import DiscrepancyItem

def find_account_discrepancies(db: Session) -> List[DiscrepancyItem]:
    """
    Detect ghost accounts across connected child applications:
    Identifies accounts where the employee is disabled/offboarded in Active Directory,
    yet their account remains ACTIVE in one or more spoke applications.
    """
    results: List[DiscrepancyItem] = []

    # Query all mappings where app account is ACTIVE
    active_app_accounts = (
        db.query(AppAccountMapping, MasterIdentity, ConnectedApplication)
        .join(MasterIdentity, AppAccountMapping.identity_id == MasterIdentity.id)
        .join(ConnectedApplication, AppAccountMapping.application_id == ConnectedApplication.id)
        .filter(AppAccountMapping.is_active_in_app == True)
        .all()
    )

    for mapping, identity, app in active_app_accounts:
        # Ghost Account Rule: Employee is inactive/disabled in Active Directory
        if not identity.is_active_in_ad:
            results.append(
                DiscrepancyItem(
                    identity_id=identity.id,
                    username=identity.username,
                    full_name=identity.full_name,
                    department=identity.department,
                    app_code=app.app_code,
                    app_name=app.app_name,
                    ad_status="DISABLED",
                    app_status="ACTIVE",
                    reason=f"Account still active in {app.app_name} but employee is disabled in AD"
                )
            )

    return results
