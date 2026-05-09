from fastapi import Request


def parse_categories(request: Request) -> list[str]:
    values = []
    values.extend(request.query_params.getlist("categories"))
    values.extend(request.query_params.getlist("categories[]"))
    return sorted({value for value in values if value})
