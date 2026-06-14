import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Circle,
  History,
  Paperclip,
  Pencil,
  Plus,
  Repeat,
  Share2,
  Trash2,
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
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [itemError, setItemError] = useState("");
  const [itemLoading, setItemLoading] = useState(false);

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
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
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

  async function handleEditSubmit() {
    setEditError("");
    setEditLoading(true);

    try {
      await fakrasApi.updateFakra(id, {
        title: editTitle,
        description: editDescription || null,
        due_date: editDueDate || null,
        recurrence: editRecurrence,
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

  async function handleAddItem() {
    setItemError("");
    setItemLoading(true);

    try {
      await fakrasApi.createItem(id, {
        name: newItemName,
        quantity: Number(newItemQuantity) || 1,
        unit: newItemUnit || null,
      });
      setNewItemName("");
      setNewItemQuantity("1");
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

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t("fakraDetail.items")}</Text>

        <View style={styles.itemFormRow}>
          <View style={styles.itemNameField}>
            <Label>{t("common.name")}</Label>
            <Input value={newItemName} onChangeText={setNewItemName} />
          </View>
          <View style={styles.itemQtyField}>
            <Label>{t("fakraDetail.qty")}</Label>
            <Input value={newItemQuantity} onChangeText={setNewItemQuantity} keyboardType="numeric" />
          </View>
          <View style={styles.itemUnitField}>
            <Label>{t("fakraDetail.unit")}</Label>
            <Input value={newItemUnit} onChangeText={setNewItemUnit} />
          </View>
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
                </Pressable>
                <View style={styles.itemActions}>
                  <IconButton
                    icon={Paperclip}
                    label={t("fakraDetail.addPhoto")}
                    onPress={() => handleAddPhoto(item)}
                    disabled={uploadingItemId === item.id}
                  />
                  <IconButton icon={Trash2} label={t("fakraDetail.deleteItem")} onPress={() => handleDeleteItem(item.id)} />
                </View>
              </View>

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
  field: { marginBottom: 0 },
  activityEntry: { fontSize: 14, color: colors.slate700 },
  successText: { fontSize: 14, color: colors.emerald600 },
  itemFormRow: { flexDirection: "row", gap: 8 },
  itemNameField: { flex: 2 },
  itemQtyField: { flex: 1 },
  itemUnitField: { flex: 1 },
  itemContainer: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemToggle: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  itemName: { fontSize: 14, color: colors.slate700 },
  itemNameDone: { fontSize: 14, color: colors.slate300, textDecorationLine: "line-through" },
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
