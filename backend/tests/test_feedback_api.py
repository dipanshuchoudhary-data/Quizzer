from backend.api.feedback import resolve_feedback_contact_email


def test_resolve_feedback_contact_email_prefers_explicit_contact_email():
    resolved = resolve_feedback_contact_email(
        contact_email="  Contact@Example.com ",
        user_email="user@example.com",
    )

    assert resolved == "contact@example.com"


def test_resolve_feedback_contact_email_falls_back_to_user_email():
    resolved = resolve_feedback_contact_email(
        contact_email=None,
        user_email="  USER@Example.com ",
    )

    assert resolved == "user@example.com"


def test_resolve_feedback_contact_email_returns_none_when_missing():
    resolved = resolve_feedback_contact_email(
        contact_email="   ",
        user_email=None,
    )

    assert resolved is None
