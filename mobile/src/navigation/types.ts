export type RootStackParamList = {
  Tabs: undefined;
  Compose: undefined;
  PostDetail: { postId: string };
  Sos: undefined;
  Moderation: undefined;
  Games: undefined;
  Messages: undefined;
  Chat: { neighborId: string; neighborName: string };
  Services: undefined;
  Items: undefined;
  Groups: undefined;
  Map: undefined;
  Vacation: undefined;
  Waste: undefined;
  Solidarity: undefined;
  Move: undefined;
  Story: { index: number };
  NewStory: undefined;
};

export type TabParamList = {
  Feed: undefined;
  Alerts: undefined;
  Neighborhood: undefined;
  Profile: undefined;
};
