import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../constants/colors";

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.blue950,
  },
});
