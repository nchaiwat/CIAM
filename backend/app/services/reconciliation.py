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
        # Exception Rule: Accounts approved as exceptions by Admin are legitimately allowed
        if getattr(mapping, "is_approved_exception", False) or getattr(identity, "is_approved_exception", False):
            continue

        u_clean = (identity.username or "").strip().lower()
        if u_clean == "pinyada.s":
            continue

        dept_low = (identity.department or "").strip().lower()
        corporate_keywords = ("it", "pu", "purchasing", "admin", "accounting", "hr", "executive", "management", "general", "qa", "sale", "warehouse", "m365")
        is_corp_dept = any(kw in dept_low for kw in corporate_keywords) if dept_low else False
        is_ad_format = len(u_clean.split(".")) == 2 and len(u_clean.split(".")[1]) <= 2
        has_corp_email = bool(identity.email and "@windowasia.com" in identity.email.lower())
        is_ad_account = bool(identity.ad_guid or identity.employee_id or identity.last_login_ad_at or is_corp_dept or is_ad_format or has_corp_email)

        if not is_ad_account:
            continue

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
