"""Centralized authorization for Fakras, Items and Attachments.

Every "who is allowed to do X" decision lives here, expressed against three
relationships a user can have to a Fakra:

  * creator        — user created the Fakra (``fakra.created_by``)
  * group role     — for a group (household) Fakra: owner / admin / member
  * shared access  — a personal Fakra explicitly shared via ``FakraAccess``

Views must call these helpers rather than re-deriving rules inline, so the
policy stays consistent across REST, WebSocket and background code paths.

Policy (agreed matrix):
  view Fakra ............. creator | any group member | shared user
  create group Fakra ..... any group member (owner/admin/member)
  edit Fakra ............. creator | group owner/admin
  delete Fakra ........... creator | group owner/admin
  archive Fakra .......... creator | group owner/admin
  share Fakra ............ creator | group owner/admin
  add item ............... anyone who can view the Fakra
  complete/undo item ..... anyone who can view the Fakra
  edit/delete item ....... item creator | Fakra creator | group owner/admin
  add attachment ......... anyone who can view the Fakra
  delete attachment ...... uploader | Fakra creator | group owner/admin
"""

from rest_framework.exceptions import PermissionDenied

GROUP_MANAGER_ROLES = ("owner", "admin")


def group_role(user, fakra):
    """The user's role in the Fakra's group, or None (personal Fakra / no member)."""
    if not fakra.household_id:
        return None
    membership = fakra.household.memberships.filter(user=user).first()
    return membership.role if membership else None


def _is_group_manager(user, fakra):
    return group_role(user, fakra) in GROUP_MANAGER_ROLES


# --- Fakra ---------------------------------------------------------------

def can_view_fakra(user, fakra):
    if fakra.created_by_id == user.id:
        return True
    if fakra.household_id and fakra.household.memberships.filter(user=user).exists():
        return True
    if fakra.access.filter(user=user).exists():
        return True
    return False


# Backwards-compatible alias (was the module's original public helper).
def user_can_access_fakra(user, fakra):
    return can_view_fakra(user, fakra)


def can_edit_fakra(user, fakra):
    return fakra.created_by_id == user.id or _is_group_manager(user, fakra)


def can_delete_fakra(user, fakra):
    return fakra.created_by_id == user.id or _is_group_manager(user, fakra)


def can_archive_fakra(user, fakra):
    return fakra.created_by_id == user.id or _is_group_manager(user, fakra)


def can_share_fakra(user, fakra):
    return fakra.created_by_id == user.id or _is_group_manager(user, fakra)


# --- Item ----------------------------------------------------------------

def can_add_item(user, fakra):
    return can_view_fakra(user, fakra)


def can_complete_item(user, item):
    return can_view_fakra(user, item.fakra)


def can_modify_item(user, item):
    """Edit or delete an item: its creator, the Fakra creator, or a group manager."""
    fakra = item.fakra
    if item.created_by_id == user.id:
        return True
    if fakra.created_by_id == user.id:
        return True
    return _is_group_manager(user, fakra)


# --- Attachment ----------------------------------------------------------

def can_add_attachment(user, item):
    return can_view_fakra(user, item.fakra)


def can_delete_attachment(user, attachment):
    fakra = attachment.item.fakra
    if attachment.uploaded_by_id == user.id:
        return True
    if fakra.created_by_id == user.id:
        return True
    return _is_group_manager(user, fakra)


# --- require_* wrappers (raise 403) --------------------------------------

def _require(ok, message):
    if not ok:
        raise PermissionDenied(message)


def require_fakra_access(user, fakra):
    _require(can_view_fakra(user, fakra), "You do not have access to this Fakra")


def require_can_edit_fakra(user, fakra):
    _require(can_edit_fakra(user, fakra),
             "Only the creator or a group owner/admin can edit this Fakra")


def require_can_delete_fakra(user, fakra):
    _require(can_delete_fakra(user, fakra),
             "Only the creator or a group owner/admin can delete this Fakra")


def require_can_archive_fakra(user, fakra):
    _require(can_archive_fakra(user, fakra),
             "Only the creator or a group owner/admin can archive this Fakra")


def require_can_share_fakra(user, fakra):
    _require(can_share_fakra(user, fakra),
             "Only the creator or a group owner/admin can share this Fakra")


def require_can_modify_item(user, item):
    _require(can_modify_item(user, item),
             "Only the item's creator, the Fakra creator, or a group admin can modify this item")


def require_can_delete_attachment(user, attachment):
    _require(can_delete_attachment(user, attachment),
             "Only the uploader, the Fakra creator, or a group admin can remove this attachment")


def fakra_permissions(user, fakra):
    """The caller's allowed actions on a Fakra, for clients to gate their UI."""
    return {
        "can_edit": can_edit_fakra(user, fakra),
        "can_delete": can_delete_fakra(user, fakra),
        "can_archive": can_archive_fakra(user, fakra),
        "can_share": can_share_fakra(user, fakra),
        "can_add_item": can_add_item(user, fakra),
        "role": group_role(user, fakra),
    }
