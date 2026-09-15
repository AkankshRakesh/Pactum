from django.urls import path

from . import views

app_name = "core"

urlpatterns = [
    path("api/home/", views.home_data, name="home-data"),
    path("", views.home, name="home"),
]
