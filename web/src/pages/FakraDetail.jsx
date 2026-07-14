import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CalendarDays,
  Camera,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  FileText,
  History,
  Lightbulb,
  Paperclip,
  Pencil,
  Plus,
  Repeat,
  Share2,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import * as fakrasApi from "../api/fakras";
import { useFakraSocket } from "../hooks/useFakraSocket";
import { Badge, Button, Card, ErrorText, IconButton, Input, Label, Select, Textarea, extractError } from "../components/ui";
import { getDueStatus } from "../utils/dueStatus";
import { downloadCsv, itemsToCsv } from "../utils/csv";

const DUE_STATUS_COLORS = {
  dueSoon: "yellow",
  overdue: "red",
};

export default function FakraDetail() {
  const { id } = useParams();
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
  const [editRecurrence, setEditRecurrence] = useState("none");
  const [editBudget, setEditBudget] = useState("");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [priceHint, setPriceHint] = useState(null);
  const [itemError, setItemError] = useState("");
  const [itemLoading, setItemLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);

  const [editingItem, setEditingItem] = useState(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQty, setEditItemQty] = useState(1);
  const [editItemUnit, setEditItemUnit] = useState("");
  const [editItemCategory, setEditItemCategory] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
  const [editItemError, setEditItemError] = useState("");
  const [editItemLoading, setEditItemLoading] = useState(false);

  const [smartAddText, setSmartAddText] = useState("");
  const [smartAddError, setSmartAddError] = useState("");
  const [smartAddLoading, setSmartAddLoading] = useState(false);

  const [scanError, setScanError] = useState("");
  const [scanLoading, setScanLoading] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [addingSuggestion, setAddingSuggestion] = useState(null);

  const [commandText, setCommandText] = useState("");
  const [commandError, setCommandError] = useState("");
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandSkipped, setCommandSkipped] = useState([]);

  const [shareUserIds, setShareUserIds] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const [showActivity, setShowActivity] = useState(false);

  const fileInputRef = useRef(null);
  const scanFileInputRef = useRef(null);
  const [pendingItemId, setPendingItemId] = useState(null);
  const [uploadingItemId, setUploadingItemId] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fakrasApi.getFakra(id);
      setFakra(response.data);
      setEditTitle(response.data.title);
      setEditDescription(response.data.description || "");
      setEditDueDate(response.data.due_date ? response.data.due_date.slice(0, 10) : "");
      setEditRecurrence(response.data.recurrence || "none");
      setEditBudget(response.data.budget ?? "");
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    fakrasApi.getCategorysuggestions().then((r) => setCategoryOptions(r.data)).catch(() => {});
  }, [load]);

  useFakraSocket(id, (message) => {
    if (
      message.payload?.fakra_id === Number(id) &&
      ["item.created", "item.done", "item.undo", "attachment.created", "attachment.deleted"].includes(message.event)
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
        recurrence: editRecurrence,
        budget: editBudget === "" ? null : Number(editBudget),
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

  async function handleDuplicate() {
    setActionError("");
    try {
      const response = await fakrasApi.duplicateFakra(id);
      navigate(`/fakras/${response.data.id}`);
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  function handleExportCsv() {
    const headers = [
      t("fakraDetail.csvHeaders.name"),
      t("fakraDetail.csvHeaders.quantity"),
      t("fakraDetail.csvHeaders.unit"),
      t("fakraDetail.csvHeaders.category"),
      t("fakraDetail.csvHeaders.price"),
      t("fakraDetail.csvHeaders.status"),
    ];

    const csv = itemsToCsv(fakra.items, headers);
    downloadCsv(`${fakra.title}.csv`, csv);
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
        category: newItemCategory || null,
        estimated_price: newItemPrice === "" ? null : Number(newItemPrice),
      });
      setNewItemName("");
      setNewItemQuantity(1);
      setNewItemUnit("");
      setNewItemCategory("");
      setNewItemPrice("");
      setPriceHint(null);
      load();
    } catch (err) {
      setItemError(extractError(err));
    } finally {
      setItemLoading(false);
    }
  }

  async function handlePriceBlur() {
    if (!newItemName.trim() || newItemPrice === "") {
      setPriceHint(null);
      return;
    }
    try {
      const res = await fakrasApi.checkPrice(newItemName.trim(), Number(newItemPrice));
      const a = res.data.anomaly;
      setPriceHint(a && a.is_high ? a : null);
    } catch {
      setPriceHint(null);
    }
  }

  async function handleSmartAdd(e) {
    e.preventDefault();
    setSmartAddError("");
    setSmartAddLoading(true);

    try {
      await fakrasApi.smartAddItems(id, smartAddText);
      setSmartAddText("");
      load();
    } catch (err) {
      setSmartAddError(extractError(err));
    } finally {
      setSmartAddLoading(false);
    }
  }

  function handleScanClick() {
    scanFileInputRef.current?.click();
  }

  async function handleScanFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setScanError("");
    setScanLoading(true);

    try {
      await fakrasApi.smartScanItems(id, file);
      load();
    } catch (err) {
      setScanError(extractError(err));
    } finally {
      setScanLoading(false);
    }
  }

  async function handleGetSuggestions() {
    setSuggestionsError("");
    setSuggestionsLoading(true);

    try {
      const res = await fakrasApi.getSuggestions(id);
      setSuggestions(res.data);
    } catch (err) {
      setSuggestionsError(extractError(err));
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function handleAddSuggestion(suggestion, index) {
    setSuggestionsError("");
    setAddingSuggestion(index);

    try {
      await fakrasApi.createItem(id, {
        name: suggestion.name,
        quantity: suggestion.quantity || 1,
        unit: suggestion.unit || null,
        category: suggestion.category || null,
        notes: suggestion.notes || null,
      });
      setSuggestions((prev) => prev.filter((_, i) => i !== index));
      load();
    } catch (err) {
      setSuggestionsError(extractError(err));
    } finally {
      setAddingSuggestion(null);
    }
  }

  async function handleSmartCommand(e) {
    e.preventDefault();
    setCommandError("");
    setCommandSkipped([]);
    setCommandLoading(true);

    try {
      const res = await fakrasApi.smartCommand(id, commandText);
      setCommandText("");
      setCommandSkipped(res.data.results.filter((r) => !r.applied));
      load();
    } catch (err) {
      setCommandError(extractError(err));
    } finally {
      setCommandLoading(false);
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

  function handleStartEditItem(item) {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemQty(item.quantity);
    setEditItemUnit(item.unit || "");
    setEditItemCategory(item.category || "");
    setEditItemPrice(item.estimated_price != null ? String(item.estimated_price) : "");
    setEditItemError("");
  }

  async function handleSaveEditItem(e) {
    e.preventDefault();
    setEditItemError("");
    setEditItemLoading(true);

    try {
      await fakrasApi.updateItem(id, editingItem.id, {
        name: editItemName,
        quantity: Number(editItemQty) || 1,
        unit: editItemUnit || null,
        category: editItemCategory || null,
        estimated_price: editItemPrice === "" ? null : Number(editItemPrice),
      });
      setEditingItem(null);
      load();
    } catch (err) {
      setEditItemError(extractError(err));
    } finally {
      setEditItemLoading(false);
    }
  }

  function handleAddPhotoClick(itemId) {
    setPendingItemId(itemId);
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || pendingItemId == null) return;

    setAttachmentError("");
    setUploadingItemId(pendingItemId);

    try {
      await fakrasApi.uploadAttachment(id, pendingItemId, file);
      load();
    } catch (err) {
      setAttachmentError(extractError(err));
    } finally {
      setUploadingItemId(null);
      setPendingItemId(null);
    }
  }

  async function handleDeleteAttachment(itemId, attachmentId) {
    setAttachmentError("");
    try {
      await fakrasApi.deleteAttachment(id, itemId, attachmentId);
      load();
    } catch (err) {
      setAttachmentError(extractError(err));
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

  const perms = fakra.my_permissions || {};
  const canShare = perms.can_share && !fakra.household;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-blue-950">{fakra.title}</h1>
          {fakra.description && <p className="text-sm text-slate-500">{fakra.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge color={fakra.status === "archived" ? "gray" : "green"}>{t(`common.${fakra.status}`, fakra.status)}</Badge>
          {getDueStatus(fakra) && (
            <Badge color={DUE_STATUS_COLORS[getDueStatus(fakra)]}>{t(`common.${getDueStatus(fakra)}`)}</Badge>
          )}
          {fakra.due_date && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("fakraDetail.due", { date: new Date(fakra.due_date).toLocaleDateString() })}
            </span>
          )}
          {fakra.recurrence !== "none" && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Repeat className="h-3.5 w-3.5" />
              {t("fakraDetail.repeats", { frequency: t(`common.recurrence.${fakra.recurrence}`) })}
            </span>
          )}
        </div>
      </div>
      {fakra.recurrence_parent && (
        <p className="text-xs text-slate-400">{t("fakraDetail.continuesSeries")}</p>
      )}

      <ErrorText>{actionError}</ErrorText>

      <div className="flex gap-2 flex-wrap">
        {perms.can_edit && (
          <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-4 w-4" />
            {editing ? t("common.cancel") : t("common.edit")}
          </Button>
        )}
        {fakra.status === "active" && perms.can_archive && (
          <Button variant="secondary" onClick={handleArchive}>
            <Archive className="h-4 w-4" />
            {t("common.archive")}
          </Button>
        )}
        {perms.can_delete && (
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            {t("common.delete")}
          </Button>
        )}
        <Button variant="secondary" onClick={handleDuplicate}>
          <Copy className="h-4 w-4" />
          {t("fakraDetail.duplicate")}
        </Button>
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
            <div>
              <Label>{t("common.recurrenceLabel")}</Label>
              <Select value={editRecurrence} onChange={(e) => setEditRecurrence(e.target.value)}>
                <option value="none">{t("common.recurrence.none")}</option>
                <option value="daily">{t("common.recurrence.daily")}</option>
                <option value="weekly">{t("common.recurrence.weekly")}</option>
                <option value="monthly">{t("common.recurrence.monthly")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("fakraDetail.budget")}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
                placeholder={t("fakraDetail.budgetPlaceholder")}
              />
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

      {fakra.budget != null && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium text-blue-950 dark:text-blue-100">{t("fakraDetail.budget")}</h2>
            <span className={`text-sm ${fakra.over_budget ? "text-red-600 dark:text-red-400 font-medium" : "text-slate-500"}`}>
              {t("fakraDetail.budgetSpentOf", {
                spent: Number(fakra.estimated_spent).toFixed(2),
                budget: Number(fakra.budget).toFixed(2),
              })}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${fakra.over_budget ? "bg-red-500" : "bg-teal-500"}`}
              style={{ width: `${Math.min(100, Math.round((fakra.budget_progress || 0) * 100))}%` }}
            />
          </div>
          <p className={`mt-2 text-sm ${fakra.over_budget ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>
            {fakra.over_budget
              ? t("fakraDetail.overBudgetBy", { amount: Math.abs(Number(fakra.budget_remaining)).toFixed(2) })
              : t("fakraDetail.budgetRemaining", { amount: Number(fakra.budget_remaining).toFixed(2) })}
          </p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-medium text-blue-950">{t("fakraDetail.items")}</h2>
          <div className="flex items-center gap-3">
            {Number(fakra.estimated_total) > 0 && (
              <span className="text-sm text-slate-500">
                {t("fakraDetail.remainingOfTotal", {
                  remaining: Number(fakra.estimated_remaining).toFixed(2),
                  total: Number(fakra.estimated_total).toFixed(2),
                })}
              </span>
            )}
            {fakra.items.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Download className="h-4 w-4" />
                  {t("fakraDetail.exportCsv")}
                </button>
                <button
                  type="button"
                  onClick={() => fakrasApi.exportFakraPdf(id, `${fakra.title}.pdf`)}
                  className="flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <FileText className="h-4 w-4" />
                  {t("fakraDetail.exportPdf")}
                </button>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSmartAdd} className="flex flex-wrap gap-2 items-end mb-3">
          <div className="flex-1 min-w-[220px]">
            <Label>{t("fakraDetail.smartAdd.label")}</Label>
            <Input
              value={smartAddText}
              onChange={(e) => setSmartAddText(e.target.value)}
              placeholder={t("fakraDetail.smartAdd.placeholder")}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={smartAddLoading || !smartAddText.trim()}>
            <Sparkles className="h-4 w-4" />
            {smartAddLoading ? t("fakraDetail.smartAdd.adding") : t("fakraDetail.smartAdd.button")}
          </Button>
          <Button type="button" variant="secondary" disabled={scanLoading} onClick={handleScanClick}>
            <Camera className="h-4 w-4" />
            {scanLoading ? t("fakraDetail.smartScan.scanning") : t("fakraDetail.smartScan.button")}
          </Button>
        </form>
        <ErrorText>{smartAddError}</ErrorText>
        <ErrorText>{scanError}</ErrorText>

        <input
          ref={scanFileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleScanFileSelected}
        />

        <div className="mb-3">
          <Button type="button" variant="secondary" disabled={suggestionsLoading} onClick={handleGetSuggestions}>
            <Lightbulb className="h-4 w-4" />
            {suggestionsLoading ? t("fakraDetail.suggestions.loading") : t("fakraDetail.suggestions.button")}
          </Button>
          <ErrorText>{suggestionsError}</ErrorText>

          {suggestions.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion.name}-${index}`}>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={addingSuggestion !== null}
                    onClick={() => handleAddSuggestion(suggestion, index)}
                  >
                    <Plus className="h-4 w-4" />
                    {suggestion.name}
                    {suggestion.quantity > 1 && ` ×${suggestion.quantity}`}
                    {suggestion.unit && ` ${suggestion.unit}`}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleSmartCommand} className="flex flex-wrap gap-2 items-end mb-3">
          <div className="flex-1 min-w-[220px]">
            <Label>{t("fakraDetail.smartCommand.label")}</Label>
            <Input
              value={commandText}
              onChange={(e) => setCommandText(e.target.value)}
              placeholder={t("fakraDetail.smartCommand.placeholder")}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={commandLoading || !commandText.trim()}>
            <Wand2 className="h-4 w-4" />
            {commandLoading ? t("fakraDetail.smartCommand.running") : t("fakraDetail.smartCommand.button")}
          </Button>
        </form>
        <ErrorText>{commandError}</ErrorText>
        {commandSkipped.length > 0 && (
          <p className="text-xs text-amber-600 mb-3">{t("fakraDetail.smartCommand.skipped", { count: commandSkipped.length })}</p>
        )}

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
          <div className="w-32">
            <Label>{t("fakraDetail.category")}</Label>
            <Input
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              list="category-options"
              placeholder={t("fakraDetail.categoryPlaceholder")}
            />
            <datalist id="category-options">
              {categoryOptions.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="w-24">
            <Label>{t("fakraDetail.price")}</Label>
            <Input type="number" min={0} step="0.01" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} onBlur={handlePriceBlur} />
          </div>
          <Button type="submit" disabled={itemLoading}>
            <Plus className="h-4 w-4" />
            {itemLoading ? t("fakraDetail.adding") : t("fakraDetail.add")}
          </Button>
        </form>
        {priceHint && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
            {t("fakraDetail.priceHigh", {
              name: priceHint.name,
              avg: priceHint.avg_price,
              pct: priceHint.pct_above_avg,
            })}
          </p>
        )}
        <ErrorText>{itemError}</ErrorText>
        <ErrorText>{attachmentError}</ErrorText>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />

        {fakra.items.length === 0 ? (
          <p className="text-sm text-slate-500">{t("fakraDetail.noItems")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {fakra.items.map((item) => (
              <li key={item.id} className="group py-2 text-sm">
                {editingItem?.id === item.id ? (
                  <form onSubmit={handleSaveEditItem} className="flex flex-wrap gap-2 items-end py-1">
                    <div className="flex-1 min-w-[120px]">
                      <Label>{t("common.name")}</Label>
                      <Input required value={editItemName} onChange={(e) => setEditItemName(e.target.value)} />
                    </div>
                    <div className="w-16">
                      <Label>{t("fakraDetail.qty")}</Label>
                      <Input type="number" min={1} value={editItemQty} onChange={(e) => setEditItemQty(e.target.value)} />
                    </div>
                    <div className="w-24">
                      <Label>{t("fakraDetail.unit")}</Label>
                      <Input value={editItemUnit} onChange={(e) => setEditItemUnit(e.target.value)} />
                    </div>
                    <div className="w-28">
                      <Label>{t("fakraDetail.category")}</Label>
                      <Input value={editItemCategory} onChange={(e) => setEditItemCategory(e.target.value)} list="edit-category-options" />
                      <datalist id="edit-category-options">
                        {categoryOptions.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div className="w-20">
                      <Label>{t("fakraDetail.price")}</Label>
                      <Input type="number" min={0} step="0.01" value={editItemPrice} onChange={(e) => setEditItemPrice(e.target.value)} />
                    </div>
                    <div className="flex gap-1">
                      <Button type="submit" disabled={editItemLoading}>{editItemLoading ? t("common.saving") : t("common.save")}</Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingItem(null)}>{t("common.cancel")}</Button>
                    </div>
                    {editItemError && <ErrorText>{editItemError}</ErrorText>}
                  </form>
                ) : (
                <div className="flex items-center justify-between">
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
                    <span className={item.status === "done" ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-300"}>
                      {item.name}
                      {item.quantity > 1 && ` ×${item.quantity}`}
                      {item.unit && ` ${item.unit}`}
                    </span>
                    {item.estimated_price != null && (
                      <span className="text-xs text-slate-400">
                        {(item.estimated_price * item.quantity).toFixed(2)}
                      </span>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <IconButton
                      icon={Pencil}
                      label={t("fakraDetail.editItem")}
                      onClick={() => handleStartEditItem(item)}
                    />
                    <IconButton
                      icon={Paperclip}
                      label={t("fakraDetail.addPhoto")}
                      onClick={() => handleAddPhotoClick(item.id)}
                      disabled={uploadingItemId === item.id}
                    />
                    <IconButton
                      icon={Trash2}
                      label={t("fakraDetail.deleteItem")}
                      onClick={() => handleDeleteItem(item.id)}
                      className="hover:text-red-600 hover:bg-red-50"
                    />
                  </div>
                </div>
                )}

                {uploadingItemId === item.id && (
                  <p className="text-xs text-slate-400 mt-1 ml-7">{t("fakraDetail.uploadingPhoto")}</p>
                )}

                {item.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 ml-7">
                    {item.attachments.map((attachment) => (
                      <div key={attachment.id} className="group/thumb relative">
                        <a href={attachment.file} target="_blank" rel="noreferrer">
                          <img
                            src={attachment.file}
                            alt=""
                            className="h-14 w-14 rounded-lg object-cover border border-slate-200"
                          />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(item.id, attachment.id)}
                          aria-label={t("fakraDetail.removeAttachment")}
                          className="absolute -top-1.5 -right-1.5 hidden group-hover/thumb:flex items-center justify-center h-5 w-5 rounded-full bg-red-600 text-white"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
