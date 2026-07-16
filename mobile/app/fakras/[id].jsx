import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  Archive,
  Barcode,
  CalendarDays,
  Camera,
  CheckCircle2,
  Circle,
  Copy,
  Download,
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
} from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import * as fakrasApi from "../../src/api/fakras";
import { useFakraSocket } from "../../src/hooks/useFakraSocket";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  IconButton,
  Input,
  Label,
  Select,
  SelectItem,
  Textarea,
  extractError,
} from "../../src/components/ui";
import { colors } from "../../src/constants/colors";
import { getDueStatus } from "../../src/utils/dueStatus";
import { itemsToCsv } from "../../src/utils/csv";
import BarcodeScanner from "../../src/components/BarcodeScanner";

const DUE_STATUS_COLORS = {
  dueSoon: "yellow",
  overdue: "red",
};

export default function FakraDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
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
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [priceHint, setPriceHint] = useState(null);
  const [present, setPresent] = useState([]);
  const [itemError, setItemError] = useState("");
  const [itemLoading, setItemLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [editItemName, setEditItemName] = useState("");
  const [editItemQty, setEditItemQty] = useState("1");
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
      setEditBudget(response.data.budget != null ? String(response.data.budget) : "");
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
    if (message.event === "presence") {
      setPresent(message.payload?.users || []);
      return;
    }
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

  async function handleEditSubmit() {
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
      router.replace("/");
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleDuplicate() {
    setActionError("");
    try {
      const response = await fakrasApi.duplicateFakra(id);
      router.replace(`/fakras/${response.data.id}`);
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleAddItem() {
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
      setNewItemQuantity("1");
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

  async function handleSmartAdd() {
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

  async function handleSmartScan() {
    setScanError("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setScanError(t("fakraDetail.photoPermissionDenied"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    setScanLoading(true);
    try {
      await fakrasApi.smartScanItems(id, result.assets[0]);
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

  async function handleSmartCommand() {
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

  async function handleBarcodeScanned(barcode) {
    setShowBarcodeScanner(false);
    setBarcodeLoading(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const json = await res.json();
      if (json.status === 1 && json.product?.product_name) {
        setNewItemName(json.product.product_name);
        if (json.product.quantity) setNewItemUnit(json.product.quantity);
      }
    } catch {
      // silently ignore lookup failures
    } finally {
      setBarcodeLoading(false);
    }
  }

  function handleStartEditItem(item) {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemQty(String(item.quantity));
    setEditItemUnit(item.unit || "");
    setEditItemCategory(item.category || "");
    setEditItemPrice(item.estimated_price != null ? String(item.estimated_price) : "");
    setEditItemError("");
  }

  async function handleSaveEditItem() {
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

  async function handleDeleteItem(itemId) {
    setActionError("");
    try {
      await fakrasApi.deleteItem(id, itemId);
      load();
    } catch (err) {
      setActionError(extractError(err));
    }
  }

  async function handleAddPhoto(item) {
    setAttachmentError("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAttachmentError(t("fakraDetail.photoPermissionDenied"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) return;

    setUploadingItemId(item.id);
    try {
      await fakrasApi.uploadAttachment(id, item.id, result.assets[0]);
      load();
    } catch (err) {
      setAttachmentError(extractError(err));
    } finally {
      setUploadingItemId(null);
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

  async function handleExportCsv() {
    const headers = [
      t("fakraDetail.csvHeaders.name"),
      t("fakraDetail.csvHeaders.quantity"),
      t("fakraDetail.csvHeaders.unit"),
      t("fakraDetail.csvHeaders.category"),
      t("fakraDetail.csvHeaders.price"),
      t("fakraDetail.csvHeaders.status"),
    ];

    const csv = itemsToCsv(fakra.items, headers);
    await Share.share({ message: csv, title: `${fakra.title}.csv` });
  }

  async function handleShare() {
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

  if (loading && !fakra) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t("common.loading")}</Text>
      </View>
    );
  }
  if (error && !fakra) {
    return (
      <View style={styles.center}>
        <ErrorText>{error}</ErrorText>
      </View>
    );
  }
  if (!fakra) return null;

  const isOwner = fakra.created_by === user?.id;
  const canShare = isOwner && !fakra.household;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.headerRow}>
        <View style={styles.flex1}>
          <Text style={styles.heading}>{fakra.title}</Text>
          {fakra.description ? <Text style={styles.muted}>{fakra.description}</Text> : null}
        </View>
        <View style={styles.headerMeta}>
          <Badge color={fakra.status === "archived" ? "gray" : "green"}>{t(`common.${fakra.status}`, fakra.status)}</Badge>
          {getDueStatus(fakra) && (
            <Badge color={DUE_STATUS_COLORS[getDueStatus(fakra)]}>{t(`common.${getDueStatus(fakra)}`)}</Badge>
          )}
          {fakra.due_date ? (
            <View style={styles.dueDate}>
              <CalendarDays size={14} color={colors.slate500} />
              <Text style={styles.dueDateText}>
                {t("fakraDetail.due", { date: new Date(fakra.due_date).toLocaleDateString() })}
              </Text>
            </View>
          ) : null}
          {fakra.recurrence !== "none" ? (
            <View style={styles.dueDate}>
              <Repeat size={14} color={colors.slate500} />
              <Text style={styles.dueDateText}>
                {t("fakraDetail.repeats", { frequency: t(`common.recurrence.${fakra.recurrence}`) })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {fakra.recurrence_parent ? (
        <Text style={styles.muted}>{t("fakraDetail.continuesSeries")}</Text>
      ) : null}

      {present.length > 0 ? (
        <View style={styles.presenceRow}>
          <View style={styles.presenceAvatars}>
            {present.slice(0, 5).map((u, i) => (
              <View key={u.id} style={[styles.presenceAvatar, i > 0 && styles.presenceAvatarOverlap]}>
                <Text style={styles.presenceInitial}>
                  {(u.name || u.email || "?").trim().charAt(0).toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.presenceDot} />
          <Text style={styles.presenceText}>{t("fakraDetail.viewingNow", { count: present.length })}</Text>
        </View>
      ) : null}

      <ErrorText>{actionError}</ErrorText>

      <View style={styles.actionsRow}>
        <Button variant="secondary" onPress={() => setEditing((v) => !v)}>
          <Pencil size={16} color={colors.slate700} />
          <Text style={styles.secondaryLabel}>{editing ? t("common.cancel") : t("common.edit")}</Text>
        </Button>
        {fakra.status === "active" && (
          <Button variant="secondary" onPress={handleArchive}>
            <Archive size={16} color={colors.slate700} />
            <Text style={styles.secondaryLabel}>{t("common.archive")}</Text>
          </Button>
        )}
        {isOwner && (
          <Button variant="danger" onPress={handleDelete}>
            <Trash2 size={16} color={colors.red600} />
            <Text style={styles.dangerLabel}>{t("common.delete")}</Text>
          </Button>
        )}
        <Button variant="secondary" onPress={handleDuplicate}>
          <Copy size={16} color={colors.slate700} />
          <Text style={styles.secondaryLabel}>{t("fakraDetail.duplicate")}</Text>
        </Button>
        <Button variant="secondary" onPress={toggleActivity}>
          <History size={16} color={colors.slate700} />
          <Text style={styles.secondaryLabel}>{showActivity ? t("fakraDetail.hideActivity") : t("fakraDetail.showActivity")}</Text>
        </Button>
      </View>

      {editing && (
        <Card style={styles.card}>
          <View style={styles.field}>
            <Label>{t("common.title")}</Label>
            <Input value={editTitle} onChangeText={setEditTitle} />
          </View>
          <View style={styles.field}>
            <Label>{t("common.description")}</Label>
            <Textarea value={editDescription} onChangeText={setEditDescription} />
          </View>
          <View style={styles.field}>
            <Label>{t("common.dueDate")}</Label>
            <Input value={editDueDate} onChangeText={setEditDueDate} placeholder="YYYY-MM-DD" />
          </View>
          <View style={styles.field}>
            <Label>{t("common.recurrenceLabel")}</Label>
            <Select selectedValue={editRecurrence} onValueChange={setEditRecurrence}>
              <SelectItem label={t("common.recurrence.none")} value="none" />
              <SelectItem label={t("common.recurrence.daily")} value="daily" />
              <SelectItem label={t("common.recurrence.weekly")} value="weekly" />
              <SelectItem label={t("common.recurrence.monthly")} value="monthly" />
            </Select>
          </View>
          <View style={styles.field}>
            <Label>{t("fakraDetail.budget")}</Label>
            <Input value={editBudget} onChangeText={setEditBudget} keyboardType="numeric" placeholder={t("fakraDetail.budgetPlaceholder")} />
          </View>
          <ErrorText>{editError}</ErrorText>
          <Button disabled={editLoading} onPress={handleEditSubmit}>
            {editLoading ? t("common.saving") : t("common.save")}
          </Button>
        </Card>
      )}

      {showActivity && (
        <Card style={styles.card}>
          <View style={styles.cardTitleRow}>
            <History size={16} color={colors.blue700} />
            <Text style={styles.cardTitle}>{t("fakraDetail.activity")}</Text>
          </View>
          {activity.length === 0 ? (
            <Text style={styles.muted}>{t("fakraDetail.noActivity")}</Text>
          ) : (
            activity.map((entry) => (
              <Text key={entry.id} style={styles.activityEntry}>
                <Text style={styles.muted}>{new Date(entry.created_at).toLocaleString()} — </Text>
                {entry.description}
              </Text>
            ))
          )}
        </Card>
      )}

      {canShare && (
        <Card style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Share2 size={16} color={colors.blue700} />
            <Text style={styles.cardTitle}>{t("fakraDetail.share")}</Text>
          </View>
          <Label>{t("fakraDetail.shareUserIds")}</Label>
          <Input value={shareUserIds} onChangeText={setShareUserIds} placeholder="e.g. 2, 5" />
          <ErrorText>{shareError}</ErrorText>
          {shareSuccess ? <Text style={styles.successText}>{shareSuccess}</Text> : null}
          <Button disabled={shareLoading} onPress={handleShare}>
            <Share2 size={16} color={colors.white} />
            <Text style={styles.buttonLabel}>{shareLoading ? t("fakraDetail.sharing") : t("fakraDetail.share")}</Text>
          </Button>
        </Card>
      )}

      {fakra.budget != null ? (
        <Card style={styles.card}>
          <View style={styles.budgetHeader}>
            <Text style={styles.cardTitle}>{t("fakraDetail.budget")}</Text>
            <Text style={fakra.over_budget ? styles.budgetOver : styles.muted}>
              {t("fakraDetail.budgetSpentOf", {
                spent: Number(fakra.estimated_spent).toFixed(2),
                budget: Number(fakra.budget).toFixed(2),
              })}
            </Text>
          </View>
          <View style={styles.budgetTrack}>
            <View
              style={[
                styles.budgetFill,
                fakra.over_budget ? styles.budgetFillOver : styles.budgetFillOk,
                { width: `${Math.min(100, Math.round((fakra.budget_progress || 0) * 100))}%` },
              ]}
            />
          </View>
          <Text style={fakra.over_budget ? styles.budgetOver : styles.muted}>
            {fakra.over_budget
              ? t("fakraDetail.overBudgetBy", { amount: Math.abs(Number(fakra.budget_remaining)).toFixed(2) })
              : t("fakraDetail.budgetRemaining", { amount: Number(fakra.budget_remaining).toFixed(2) })}
          </Text>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.itemsHeaderRow}>
          <Text style={styles.cardTitle}>{t("fakraDetail.items")}</Text>
          <View style={styles.itemsHeaderActions}>
            {Number(fakra.estimated_total) > 0 ? (
              <Text style={styles.muted}>
                {t("fakraDetail.remainingOfTotal", {
                  remaining: Number(fakra.estimated_remaining).toFixed(2),
                  total: Number(fakra.estimated_total).toFixed(2),
                })}
              </Text>
            ) : null}
            {fakra.items.length > 0 ? (
              <IconButton icon={Download} label={t("fakraDetail.exportCsv")} onPress={handleExportCsv} />
            ) : null}
          </View>
        </View>

        <Label>{t("fakraDetail.smartAdd.label")}</Label>
        <Input
          value={smartAddText}
          onChangeText={setSmartAddText}
          placeholder={t("fakraDetail.smartAdd.placeholder")}
        />
        <View style={styles.actionsRow}>
          <Button
            disabled={smartAddLoading || !smartAddText.trim()}
            variant="secondary"
            onPress={handleSmartAdd}
          >
            <Sparkles size={16} color={colors.slate700} />
            <Text style={[styles.buttonLabel, { color: colors.slate700 }]}>
              {smartAddLoading ? t("fakraDetail.smartAdd.adding") : t("fakraDetail.smartAdd.button")}
            </Text>
          </Button>
          <Button disabled={scanLoading} variant="secondary" onPress={handleSmartScan}>
            <Camera size={16} color={colors.slate700} />
            <Text style={[styles.buttonLabel, { color: colors.slate700 }]}>
              {scanLoading ? t("fakraDetail.smartScan.scanning") : t("fakraDetail.smartScan.button")}
            </Text>
          </Button>
        </View>
        <ErrorText>{smartAddError}</ErrorText>
        <ErrorText>{scanError}</ErrorText>

        <Button disabled={suggestionsLoading} variant="secondary" onPress={handleGetSuggestions}>
          <Lightbulb size={16} color={colors.slate700} />
          <Text style={[styles.buttonLabel, { color: colors.slate700 }]}>
            {suggestionsLoading ? t("fakraDetail.suggestions.loading") : t("fakraDetail.suggestions.button")}
          </Text>
        </Button>
        <ErrorText>{suggestionsError}</ErrorText>

        {suggestions.length > 0 && (
          <View style={styles.actionsRow}>
            {suggestions.map((suggestion, index) => (
              <Button
                key={`${suggestion.name}-${index}`}
                disabled={addingSuggestion !== null}
                variant="secondary"
                onPress={() => handleAddSuggestion(suggestion, index)}
              >
                <Plus size={16} color={colors.slate700} />
                <Text style={[styles.buttonLabel, { color: colors.slate700 }]}>
                  {suggestion.name}
                  {suggestion.quantity > 1 && ` ×${suggestion.quantity}`}
                  {suggestion.unit && ` ${suggestion.unit}`}
                </Text>
              </Button>
            ))}
          </View>
        )}

        <Label>{t("fakraDetail.smartCommand.label")}</Label>
        <Input
          value={commandText}
          onChangeText={setCommandText}
          placeholder={t("fakraDetail.smartCommand.placeholder")}
        />
        <Button disabled={commandLoading || !commandText.trim()} variant="secondary" onPress={handleSmartCommand}>
          <Wand2 size={16} color={colors.slate700} />
          <Text style={[styles.buttonLabel, { color: colors.slate700 }]}>
            {commandLoading ? t("fakraDetail.smartCommand.running") : t("fakraDetail.smartCommand.button")}
          </Text>
        </Button>
        <ErrorText>{commandError}</ErrorText>
        {commandSkipped.length > 0 ? (
          <Text style={styles.skippedText}>{t("fakraDetail.smartCommand.skipped", { count: commandSkipped.length })}</Text>
        ) : null}

        <View style={styles.itemFormRow}>
          <View style={styles.itemNameField}>
            <Label>{t("common.name")}</Label>
            <View style={styles.nameWithBarcode}>
              <Input style={styles.nameInput} value={newItemName} onChangeText={setNewItemName} />
              <Pressable onPress={() => setShowBarcodeScanner(true)} style={styles.barcodeBtn}>
                {barcodeLoading ? <ActivityIndicator size="small" color={colors.slate500} /> : <Barcode size={20} color={colors.slate500} />}
              </Pressable>
            </View>
          </View>
          <View style={styles.itemQtyField}>
            <Label>{t("fakraDetail.qty")}</Label>
            <Input value={newItemQuantity} onChangeText={setNewItemQuantity} keyboardType="numeric" />
          </View>
          <View style={styles.itemUnitField}>
            <Label>{t("fakraDetail.unit")}</Label>
            <Input value={newItemUnit} onChangeText={setNewItemUnit} />
          </View>
          <View style={styles.itemUnitField}>
            <Label>{t("fakraDetail.price")}</Label>
            <Input value={newItemPrice} onChangeText={setNewItemPrice} onBlur={handlePriceBlur} keyboardType="numeric" />
          </View>
        </View>
        {priceHint ? (
          <Text style={styles.priceHint}>
            {t("fakraDetail.priceHigh", { name: priceHint.name, avg: priceHint.avg_price, pct: priceHint.pct_above_avg })}
          </Text>
        ) : null}
        <View style={styles.field}>
          <Label>{t("fakraDetail.category")}</Label>
          <Input
            value={newItemCategory}
            onChangeText={(v) => { setNewItemCategory(v); setShowCategorySuggestions(true); }}
            onBlur={() => setShowCategorySuggestions(false)}
            placeholder={t("fakraDetail.categoryPlaceholder")}
          />
          {showCategorySuggestions && categoryOptions.filter((c) =>
            c.toLowerCase().startsWith(newItemCategory.toLowerCase()) && newItemCategory
          ).length > 0 ? (
            <View style={styles.categorySuggestions}>
              {categoryOptions
                .filter((c) => c.toLowerCase().startsWith(newItemCategory.toLowerCase()) && newItemCategory)
                .map((c) => (
                  <Pressable key={c} onPress={() => { setNewItemCategory(c); setShowCategorySuggestions(false); }}>
                    <Text style={styles.categorySuggestionItem}>{c}</Text>
                  </Pressable>
                ))}
            </View>
          ) : null}
        </View>
        <Button disabled={itemLoading} onPress={handleAddItem}>
          <Plus size={16} color={colors.white} />
          <Text style={styles.buttonLabel}>{itemLoading ? t("fakraDetail.adding") : t("fakraDetail.add")}</Text>
        </Button>
        <ErrorText>{itemError}</ErrorText>
        <ErrorText>{attachmentError}</ErrorText>

        {fakra.items.length === 0 ? (
          <Text style={styles.muted}>{t("fakraDetail.noItems")}</Text>
        ) : (
          fakra.items.map((item) => (
            <View key={item.id} style={styles.itemContainer}>
              {editingItem?.id === item.id ? (
                <View style={styles.editItemForm}>
                  <View style={styles.itemFormRow}>
                    <View style={styles.itemNameField}>
                      <Label>{t("common.name")}</Label>
                      <Input value={editItemName} onChangeText={setEditItemName} />
                    </View>
                    <View style={styles.itemQtyField}>
                      <Label>{t("fakraDetail.qty")}</Label>
                      <Input value={editItemQty} onChangeText={setEditItemQty} keyboardType="numeric" />
                    </View>
                  </View>
                  <View style={styles.itemFormRow}>
                    <View style={styles.itemUnitField}>
                      <Label>{t("fakraDetail.unit")}</Label>
                      <Input value={editItemUnit} onChangeText={setEditItemUnit} />
                    </View>
                    <View style={styles.itemUnitField}>
                      <Label>{t("fakraDetail.category")}</Label>
                      <Input value={editItemCategory} onChangeText={setEditItemCategory} />
                    </View>
                    <View style={styles.itemUnitField}>
                      <Label>{t("fakraDetail.price")}</Label>
                      <Input value={editItemPrice} onChangeText={setEditItemPrice} keyboardType="numeric" />
                    </View>
                  </View>
                  <ErrorText>{editItemError}</ErrorText>
                  <View style={styles.actionsRow}>
                    <Button disabled={editItemLoading} onPress={handleSaveEditItem}>
                      <Text style={styles.buttonLabel}>{editItemLoading ? t("common.saving") : t("common.save")}</Text>
                    </Button>
                    <Button variant="secondary" onPress={() => setEditingItem(null)}>
                      <Text style={styles.secondaryLabel}>{t("common.cancel")}</Text>
                    </Button>
                  </View>
                </View>
              ) : (
              <View style={styles.itemRow}>
                <Pressable style={styles.itemToggle} onPress={() => handleToggleItem(item)}>
                  {item.status === "done" ? (
                    <CheckCircle2 size={20} color={colors.emerald600} />
                  ) : (
                    <Circle size={20} color={colors.slate300} />
                  )}
                  <Text style={item.status === "done" ? styles.itemNameDone : styles.itemName}>
                    {item.name}
                    {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                    {item.unit ? ` ${item.unit}` : ""}
                  </Text>
                  {item.estimated_price != null ? (
                    <Text style={styles.itemPrice}>{(item.estimated_price * item.quantity).toFixed(2)}</Text>
                  ) : null}
                </Pressable>
                <View style={styles.itemActions}>
                  <IconButton
                    icon={Pencil}
                    label={t("fakraDetail.editItem")}
                    onPress={() => handleStartEditItem(item)}
                  />
                  <IconButton
                    icon={Paperclip}
                    label={t("fakraDetail.addPhoto")}
                    onPress={() => handleAddPhoto(item)}
                    disabled={uploadingItemId === item.id}
                  />
                  <IconButton icon={Trash2} label={t("fakraDetail.deleteItem")} onPress={() => handleDeleteItem(item.id)} />
                </View>
              </View>
              )}

              {uploadingItemId === item.id ? (
                <Text style={styles.muted}>{t("fakraDetail.uploadingPhoto")}</Text>
              ) : null}

              {item.attachments?.length > 0 ? (
                <View style={styles.attachmentsRow}>
                  {item.attachments.map((attachment) => (
                    <View key={attachment.id} style={styles.attachmentThumb}>
                      <Image source={{ uri: attachment.file }} style={styles.attachmentImage} />
                      <Pressable
                        style={styles.attachmentRemove}
                        onPress={() => handleDeleteAttachment(item.id, attachment.id)}
                        accessibilityLabel={t("fakraDetail.removeAttachment")}
                      >
                        <Trash2 size={12} color={colors.white} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))
        )}
      </Card>
    </ScrollView>

    <BarcodeScanner
      visible={showBarcodeScanner}
      onScanned={handleBarcodeScanned}
      onClose={() => setShowBarcodeScanner(false)}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.slate50 },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  flex1: { flex: 1 },
  heading: { fontSize: 18, fontWeight: "600", color: colors.blue950 },
  headerMeta: { alignItems: "flex-end", gap: 4 },
  dueDate: { flexDirection: "row", alignItems: "center", gap: 4 },
  dueDateText: { fontSize: 12, color: colors.slate500 },
  muted: { fontSize: 14, color: colors.slate500 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  secondaryLabel: { color: colors.slate700, fontSize: 14, fontWeight: "500" },
  dangerLabel: { color: colors.red600, fontSize: 14, fontWeight: "500" },
  buttonLabel: { color: colors.white, fontSize: 14, fontWeight: "500" },
  card: { gap: 8 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontWeight: "500", color: colors.blue950 },
  itemsHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  itemsHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  field: { marginBottom: 0 },
  categorySuggestions: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 8,
    backgroundColor: colors.white,
    marginTop: 2,
  },
  categorySuggestionItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.slate700,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  activityEntry: { fontSize: 14, color: colors.slate700 },
  successText: { fontSize: 14, color: colors.emerald600 },
  skippedText: { fontSize: 12, color: colors.amber700 },
  priceHint: { fontSize: 13, color: "#b45309", marginTop: 4 },
  presenceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  presenceAvatars: { flexDirection: "row" },
  presenceAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.blue600, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.white },
  presenceAvatarOverlap: { marginLeft: -8 },
  presenceInitial: { color: colors.white, fontSize: 12, fontWeight: "600" },
  presenceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald600 },
  presenceText: { fontSize: 12, color: colors.slate500 },
  budgetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  budgetOver: { fontSize: 13, color: colors.red600, fontWeight: "600" },
  budgetTrack: { height: 10, borderRadius: 999, backgroundColor: colors.slate100, overflow: "hidden" },
  budgetFill: { height: "100%", borderRadius: 999 },
  budgetFillOk: { backgroundColor: colors.blue500 },
  budgetFillOver: { backgroundColor: colors.red600 },
  itemFormRow: { flexDirection: "row", gap: 8 },
  itemNameField: { flex: 2 },
  nameWithBarcode: { flexDirection: "row", alignItems: "center", gap: 6 },
  nameInput: { flex: 1 },
  barcodeBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.slate100 },
  itemQtyField: { flex: 1 },
  itemUnitField: { flex: 1 },
  itemContainer: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  editItemForm: { gap: 8, paddingVertical: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemToggle: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  itemName: { fontSize: 14, color: colors.slate700 },
  itemNameDone: { fontSize: 14, color: colors.slate300, textDecorationLine: "line-through" },
  itemPrice: { fontSize: 12, color: colors.slate400 },
  attachmentsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginLeft: 28 },
  attachmentThumb: { position: "relative" },
  attachmentImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.slate100,
  },
  attachmentRemove: {
    position: "absolute",
    top: -4,
    right: -4,
    height: 20,
    width: 20,
    borderRadius: 10,
    backgroundColor: colors.red600,
    alignItems: "center",
    justifyContent: "center",
  },
});
