from django.urls import path

from . import views

app_name = "core"

urlpatterns = [
    path("api/home/", views.home_data, name="home-data"),
    path("api/auth/csrf/", views.csrf_token, name="csrf-token"),
    path("api/auth/signup/", views.signup, name="signup"),
    path("api/auth/login/", views.login_view, name="login"),
    path("api/auth/logout/", views.logout_view, name="logout"),
    path("api/auth/me/", views.current_user, name="current-user"),
    path("api/auth/google/start/", views.google_start, name="google-start"),
    path("api/auth/google/callback/", views.google_callback, name="google-callback"),
    path("api/contracts/", views.contract_list, name="contract-list"),
    path("api/contracts/save/", views.contract_save, name="contract-save"),
    path("api/contracts/send/", views.contract_send, name="contract-send"),
    path("api/contracts/invite/", views.contract_invite, name="contract-invite"),
    path("api/contracts/<uuid:contract_id>/delete/", views.contract_delete, name="contract-delete"),
    path("api/contracts/<uuid:contract_id>/invitation/revoke/", views.contract_invitation_revoke, name="contract-invitation-revoke"),
    path("api/contracts/<uuid:contract_id>/", views.contract_detail, name="contract-detail"),
    path("api/invitations/<str:token>/", views.invitation_detail, name="invitation-detail"),
    path("api/invitations/<str:token>/sign/", views.invitation_sign, name="invitation-sign"),
    path("", views.home, name="home"),
]
