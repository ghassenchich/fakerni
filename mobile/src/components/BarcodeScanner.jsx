import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X } from "lucide-react-native";
import { colors } from "../constants/colors";

export default function BarcodeScanner({ visible, onScanned, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  function handleBarcodeScanned({ data }) {
    if (scanned) return;
    setScanned(true);
    onScanned(data);
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Camera permission is required to scan barcodes.</Text>
          </View>
        )}

        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
        </View>

        <Pressable style={styles.closeBtn} onPress={onClose}>
          <X size={24} color={colors.white} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  permissionBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  permissionText: { color: colors.white, fontSize: 16, textAlign: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  scanFrame: {
    width: 240,
    height: 160,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  closeBtn: {
    position: "absolute",
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
