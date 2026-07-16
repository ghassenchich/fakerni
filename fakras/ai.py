import os
from typing import Literal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field


class ParsedItem(BaseModel):
    name: str
    quantity: int = Field(default=1)
    unit: str = Field(default="")
    category: str = Field(default="")
    notes: str = Field(default="")
    estimated_price: float | None = Field(default=None)


class ParsedItemList(BaseModel):
    items: list[ParsedItem]


class ItemCommand(BaseModel):
    item_id: int
    action: Literal["done", "undo", "delete"]


class ItemCommandList(BaseModel):
    commands: list[ItemCommand]


class AIError(Exception):
    pass


SYSTEM_PROMPT = (
    "You turn a short piece of free text into a list of shopping/to-do items "
    "for a household task list (a 'Fakra'). Split the text into individual "
    "items. For each item, fill in:\n"
    "- name: a short, clear item name\n"
    "- quantity: a whole number, default 1 if not specified\n"
    "- unit: a short unit like 'kg', 'pcs', 'L' if mentioned, otherwise an "
    "empty string\n"
    "- category: a short category like 'Groceries', 'Errands', 'Bills' if it "
    "can be inferred, otherwise an empty string\n"
    "- notes: any extra detail (e.g. a due date or brand), otherwise an "
    "empty string\n"
    "- estimated_price: always null, unless the text explicitly states a "
    "price for the item\n"
    "If the text doesn't describe any items, return an empty list."
)

SCAN_SYSTEM_PROMPT = (
    "You read a photo of a shopping list, receipt, or sticky note and turn "
    "it into a list of shopping/to-do items for a household task list (a "
    "'Fakra'). For each item, fill in:\n"
    "- name: a short, clear item name\n"
    "- quantity: a whole number, default 1 if not specified\n"
    "- unit: a short unit like 'kg', 'pcs', 'L' if mentioned, otherwise an "
    "empty string\n"
    "- category: a short category like 'Groceries', 'Errands', 'Bills' if it "
    "can be inferred, otherwise an empty string\n"
    "- notes: any extra detail (e.g. a brand), otherwise an empty string\n"
    "- estimated_price: if this looks like a receipt and a per-item price "
    "or line total is visible, the price as a number (use the line total "
    "for the quantity shown, not a unit price), otherwise null\n"
    "Ignore totals, subtotals, taxes, store names, and anything that isn't "
    "an item/task. If the image doesn't contain a readable list of items, "
    "return an empty list."
)

COMMAND_SYSTEM_PROMPT = (
    "You interpret short free-text commands from a user about items on their "
    "household task list (a 'Fakra'). You are given the existing items as a "
    "numbered list with their id, name, and status (pending or done). Map "
    "the user's text to zero or more commands, each referring to one of the "
    "given item ids:\n"
    "- action 'done': the user says they bought/finished/completed/checked "
    "off that item\n"
    "- action 'undo': the user says an item is not actually done, or to "
    "uncheck/revert it\n"
    "- action 'delete': the user says to remove/delete that item\n"
    "Only reference item ids that were given to you. If the text doesn't "
    "match any existing item or doesn't describe one of these actions, "
    "return an empty list."
)


SUGGEST_SYSTEM_PROMPT = (
    "You suggest additional items for a household task list (a 'Fakra'), "
    "based on its title and description and the items it already has. "
    "Suggest up to 5 short, relevant items that are NOT already in the "
    "list (avoid duplicates and near-duplicates of existing items). For "
    "each suggestion, fill in:\n"
    "- name: a short, clear item name\n"
    "- quantity: a whole number, default 1 if not specified\n"
    "- unit: a short unit like 'kg', 'pcs', 'L' if relevant, otherwise an "
    "empty string\n"
    "- category: a short category like 'Groceries', 'Errands', 'Bills' if "
    "it can be inferred, otherwise an empty string\n"
    "- notes: leave this an empty string\n"
    "- estimated_price: always null\n"
    "If you can't think of any good suggestions, return an empty list."
)

DIGEST_SYSTEM_PROMPT = (
    "You are a friendly assistant for a group shopping & task app. "
    "Given a group's spending statistics, write a short, encouraging summary "
    "of 2 to 3 sentences in plain language. Highlight what stands out: total "
    "spend, the top spending category, who spent the most, and whether the "
    "group is within or over budget. Do not invent numbers that aren't given, "
    "do not use markdown or bullet points, and keep it warm and concise."
)


def _client_and_model():
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise AIError("AI features are not configured")

    client = genai.Client(api_key=api_key)
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    return client, model


def parse_items_from_text(text):
    client, model = _client_and_model()

    response = client.models.generate_content(
        model=model,
        contents=text,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=ParsedItemList,
        ),
    )

    if response.parsed is None:
        raise AIError("AI Smart Add could not understand that text")

    return response.parsed.items


def parse_items_from_image(image_bytes, mime_type):
    client, model = _client_and_model()

    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
        config=types.GenerateContentConfig(
            system_instruction=SCAN_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=ParsedItemList,
        ),
    )

    if response.parsed is None:
        raise AIError("AI Smart Scan could not read that image")

    return response.parsed.items


def suggest_items_for_fakra(title, description, existing_item_names):
    client, model = _client_and_model()

    prompt = (
        f"Fakra title: {title}\n"
        f"Fakra description: {description or '(none)'}\n"
        f"Existing items: {', '.join(existing_item_names) or '(none)'}"
    )

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SUGGEST_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=ParsedItemList,
        ),
    )

    if response.parsed is None:
        raise AIError("AI suggestions are not available right now")

    return response.parsed.items


def interpret_item_commands(text, items):
    client, model = _client_and_model()

    items_text = "\n".join(
        f"- id={item.id}, name={item.name!r}, status={item.status}"
        for item in items
    )

    prompt = f"Items:\n{items_text or '(none)'}\n\nCommand: {text}"

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=COMMAND_SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=ItemCommandList,
        ),
    )

    if response.parsed is None:
        raise AIError("AI could not understand that command")

    return response.parsed.commands


def generate_spend_digest(stats_text):
    """Turn a plain-text block of spending stats into a short natural-language
    summary. Returns the summary string."""
    client, model = _client_and_model()

    response = client.models.generate_content(
        model=model,
        contents=stats_text,
        config=types.GenerateContentConfig(
            system_instruction=DIGEST_SYSTEM_PROMPT,
        ),
    )

    text = (response.text or "").strip()
    if not text:
        raise AIError("AI could not generate a summary right now")

    return text
