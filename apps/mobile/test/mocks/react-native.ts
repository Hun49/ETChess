export const Platform = {
  OS: "ios",
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
};

export const Vibration = {
  vibrate: () => {},
  cancel: () => {},
};

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
};

export const Dimensions = {
  get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
};

export const View = "View";
export const Text = "Text";
export const TouchableOpacity = "TouchableOpacity";
export const ScrollView = "ScrollView";
export const TextInput = "TextInput";
export const Modal = "Modal";
export const Switch = "Switch";
export const ActivityIndicator = "ActivityIndicator";
export const Animated = {
  Value: class {
    setValue() {}
  },
};
