from django.conf import settings
from django.http import JsonResponse
from django.utils.cache import patch_vary_headers


class FrontendCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get("Origin")
        allowed_origins = getattr(settings, "CORS_ALLOWED_ORIGINS", ())

        if request.method == "OPTIONS" and origin in allowed_origins:
            response = JsonResponse({}, status=204)
        else:
            response = self.get_response(request)

        if origin in allowed_origins:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Headers"] = "Content-Type, X-CSRFToken"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS, DELETE"
            patch_vary_headers(response, ["Origin"])

        return response