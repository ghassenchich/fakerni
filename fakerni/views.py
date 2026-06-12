from django.db import connection
from django.http import JsonResponse


def healthz(request):
    """Liveness/readiness probe: checks the app is up and the DB is reachable."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return JsonResponse({"status": "error", "database": "unreachable"}, status=503)

    return JsonResponse({"status": "ok"})
