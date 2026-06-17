"""Backend proxy to the team's predict server.

Keeps the X-Client-Id / X-Client-Secret server-side (read from the gitignored
.env) so they never reach the browser. The predict model is slow (~19s warm,
60s+ on a cold start), so the timeout is generous and callers must invoke it
sequentially for batch / mass valuation.
"""

import httpx

from app.core.config import settings


class PredictError(Exception):
    """Raised when the predict proxy cannot return a usable result.

    `status` is the HTTP status the API route should surface; `message` is an
    Azerbaijani end-user message aligned with BA §17 error copy.
    """

    def __init__(self, status: int, message: str) -> None:
        self.status = status
        self.message = message
        super().__init__(message)


async def call_predict(payload: dict) -> dict:
    """POST one property to predict.homora.ai and return its raw JSON response.

    The response is top-level (sale_estimate / rent_estimate /
    investment_metrics, no `ai_data` wrapper); the frontend adapter maps it
    into the report's ai_data shape.
    """
    if not settings.predict_url or not settings.predict_client_id:
        raise PredictError(503, "Qiymətləndirmə modeli konfiqurasiya olunmayıb.")

    headers = {
        "X-Client-Id": settings.predict_client_id,
        "X-Client-Secret": settings.predict_client_secret,
        "Content-Type": "application/json",
    }
    timeout = httpx.Timeout(settings.predict_timeout_seconds, connect=15.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(settings.predict_url, headers=headers, json=payload)
    except httpx.TimeoutException as exc:
        raise PredictError(
            504, "Qiymətləndirmə modeli vaxtında cavab vermədi, yenidən cəhd edin."
        ) from exc
    except httpx.HTTPError as exc:
        raise PredictError(
            502, "Qiymətləndirmə modelinə qoşulmaq mümkün olmadı."
        ) from exc

    if resp.status_code in (401, 403):
        raise PredictError(502, "Qiymətləndirmə modeli avtorizasiyası uğursuz oldu.")
    if resp.status_code >= 400:
        # 4xx from predict → no value for these features; 5xx → upstream issue.
        status = resp.status_code if 400 <= resp.status_code < 500 else 502
        raise PredictError(status, "Bu xüsusiyyətlərə uyğun qiymət tapılmadı!")

    try:
        return resp.json()
    except ValueError as exc:
        raise PredictError(
            502, "Qiymətləndirmə modelindən etibarsız cavab gəldi."
        ) from exc
