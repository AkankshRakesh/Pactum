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
    path("", views.home, name="home"),
]
