import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Circle,
  History,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as fakrasApi from "../api/fakras";
import { useHouseholdSocket } from "../hooks/useHouseholdSocket";
import { Badge, Button, Card, ErrorText, IconButton, Input, Label, Textarea, extractError } from "../components/ui";

export default function FakraDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [fakra, setFakra] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState("");
  const [itemError, setItemError] = useState("");
  const [itemLoading, setItemLoading] = useState(false);

  const [shareUserIds, setShareUserIds] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const [showActivity, setShowActivity] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fakrasApi.getFakra(id);
      setFakra(response.data);
      setEditTitle(response.data.title);
      setEditDescription(response.data.description || "");
      setEditDueDate(response.data.due_date ? response.data.due_date.slice(0, 10) : "");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useHouseholdSocket(fakra?.household, (message) => {
    if (
      message.payload?.fakra_id === Number(id) &&
      ["item.created", "item.done", "item.undo"].includes(message.event)
    ) {
      load();
    }
  });

  async function loadActivity() {
    try {
      const response = await fakrasApi.getActivity(id);
      setActivity(response.data);
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  function toggleActivity() {
    if (!showActivity) loadActivity();
    setShowActivity((v) => !v);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError("");
    setEditLoading(true);

    try {
      await fakrasApi.updateFakra(id, {
        title: editTitle,
        description: editDescription || null,
        due_date: editDueDate || null,
      });
      setEditing(false);
      load();
    } catch (err) {
      setEditError(extractError(err));
    } finally {
      setEditLoading(false);
    }
  }

  async function handleArchive() {
    setActionError("");
    try {
      await fakrasApi.archiveFakra(id);
      load();
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleDelete() {
    setActionError("");
    try {
      await fakrasApi.deleteFakra(id);
      navigate("/");
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    setItemError("");
    setItemLoading(true);

    try {
      await fakrasApi.createItem(id, {
        name: newItemName,
        quantity: Number(newItemQuantity) || 1,
        unit: newItemUnit || null,
      });
      setNewItemName("");
      setNewItemQuantity(1);
      setNewItemUnit("");
      load();
    } catch (err) {
      setItemError(extractError(err));
    } finally {
      setItemLoading(false);
    }
  }

  async function handleToggleItem(item) {
    setActionError("");
    try {
      if (item.status === "done") {
        await fakrasApi.undoItem(id, item.id);
      } else {
        await fakrasApi.markItemDone(id, item.id);
      }
      load();
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleDeleteItem(itemId) {
    setActionError("");
    try {
      await fakrasApi.deleteItem(id, itemId);
      load();
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleShare(e) {
    e.preventDefault();
    setShareError("");
    setShareSuccess("");
    setShareLoading(true);

    try {
      const userIds = shareUserIds
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .map(Number);

      await fakrasApi.shareFakra(id, userIds);
      setShareSuccess(t("fakraDetail.shareSuccess"));
      setShareUserIds("");
    } catch (err) {
      setShareError(extractError(err));
    } finally {
      setShareLoading(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">{t("common.loading")}</p>;
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!fakra) return null;

  const isOwner = fakra.created_by === user?.id;
  const canShare = isOwner && !fakra.household;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-blue-950">{fakra.title}</h1>
          {fakra.description && <p className="text-sm text-slate-500">{fakra.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge color={fakra.status === "archived" ? "gray" : "green"}>{t(`common.${fakra.status}`, fakra.status)}</Badge>
          {fakra.due_date && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("fakraDetail.due", { date: new Date(fakra.due_date).toLocaleDateString() })}
            </span>
          )}
        </div>
      </div>

      <ErrorText>{actionError}</ErrorText>

      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
          <Pencil className="h-4 w-4" />
          {editing ? t("common.cancel") : t("common.edit")}
        </Button>
        {fakra.status === "active" && (
          <Button variant="secondary" onClick={handleArchive}>
            <Archive className="h-4 w-4" />
            {t("common.archive")}
          </Button>
        )}
        {isOwner && (
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            {t("common.delete")}
          </Button>
        )}
        <Button variant="secondary" onClick={toggleActivity}>
          <History className="h-4 w-4" />
          {showActivity ? t("fakraDetail.hideActivity") : t("fakraDetail.showActivity")}
        </Button>
      </div>

      {editing && (
        <Card>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <div>
              <Label>{t("common.title")}</Label>
              <Input required minLength={3} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label>{t("common.description")}</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div>
              <Label>{t("common.dueDate")}</Label>
              <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
            </div>
            <ErrorText>{editError}</ErrorText>
            <Button type="submit" disabled={editLoading}>
              {editLoading ? t("common.saving") : t("common.save")}
            </Button>
          </form>
        </Card>
      )}

      {showActivity && (
        <Card>
          <h2 className="font-medium mb-2 flex items-center gap-2 text-blue-950">
            <History className="h-4 w-4 text-blue-700" />
            {t("fakraDetail.activity")}
          </h2>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">{t("fakraDetail.noActivity")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {activity.map((entry) => (
                <li key={entry.id} className="text-slate-600">
                  <span className="text-slate-400">
                    {new Date(entry.created_at).toLocaleString()} —{" "}
                  </span>
                  {entry.description}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {canShare && (
        <Card>
          <h2 className="font-medium mb-2 flex items-center gap-2 text-blue-950">
            <Share2 className="h-4 w-4 text-blue-700" />
            {t("fakraDetail.share")}
          </h2>
          <form onSubmit={handleShare} className="space-y-2">
            <Label>{t("fakraDetail.shareUserIds")}</Label>
            <Input value={shareUserIds} onChange={(e) => setShareUserIds(e.target.value)} placeholder="e.g. 2, 5" />
            <ErrorText>{shareError}</ErrorText>
            {shareSuccess && <p className="text-sm text-green-600">{shareSuccess}</p>}
            <Button type="submit" disabled={shareLoading}>
              <Share2 className="h-4 w-4" />
              {shareLoading ? t("fakraDetail.sharing") : t("fakraDetail.share")}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="font-medium mb-2 text-blue-950">{t("fakraDetail.items")}</h2>

        <form onSubmit={handleAddItem} className="flex flex-wrap gap-2 items-end mb-3">
          <div className="flex-1 min-w-[140px]">
            <Label>{t("common.name")}</Label>
            <Input required value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
          </div>
          <div className="w-20">
            <Label>{t("fakraDetail.qty")}</Label>
            <Input type="number" min={1} value={newItemQuantity} onChange={(e) => setNewItemQuantity(e.target.value)} />
          </div>
          <div className="w-28">
            <Label>{t("fakraDetail.unit")}</Label>
            <Input value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)} />
          </div>
          <Button type="submit" disabled={itemLoading}>
            <Plus className="h-4 w-4" />
            {itemLoading ? t("fakraDetail.adding") : t("fakraDetail.add")}
          </Button>
        </form>
        <ErrorText>{itemError}</ErrorText>

        {fakra.items.length === 0 ? (
          <p className="text-sm text-slate-500">{t("fakraDetail.noItems")}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {fakra.items.map((item) => (
              <li key={item.id} className="group flex items-center justify-between py-2 text-sm">
                <button
                  type="button"
                  onClick={() => handleToggleItem(item)}
                  className="flex items-center gap-2 text-left"
                >
                  {item.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 transition-transform duration-150 group-hover:scale-110" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 transition-transform duration-150 group-hover:scale-110 group-hover:text-blue-600" />
                  )}
                  <span className={item.status === "done" ? "line-through text-slate-400" : "text-slate-700"}>
                    {item.name}
                    {item.quantity > 1 && ` ×${item.quantity}`}
                    {item.unit && ` ${item.unit}`}
                  </span>
                </button>
                <IconButton
                  icon={Trash2}
                  label={t("fakraDetail.deleteItem")}
                  onClick={() => handleDeleteItem(item.id)}
                  className="hover:text-red-600 hover:bg-red-50"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
