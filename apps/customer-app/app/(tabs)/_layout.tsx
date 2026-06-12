import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name,
  color,
  size,
}: {
  name: IoniconsName;
  color: string;
  size: number;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textHint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ໜ້າຫຼັກ',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'ການສັ່ງ',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'ສະແກນ',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="qr-code-outline" color={color} size={size} />
          ),
          tabBarStyle: {
            backgroundColor: COLORS.darkPage,
            borderTopColor: '#1E293B',
            borderTopWidth: 1,
          },
          tabBarActiveTintColor: COLORS.cyan,
          tabBarInactiveTintColor: COLORS.textHint,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'ໂປຣໄຟລ໌',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
