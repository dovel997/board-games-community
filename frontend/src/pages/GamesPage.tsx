import { Badge, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core'

// Dummy data until the API exists.
const games = [
  { id: 1, name: 'Catan', players: '3–4', time: '60–120 min', category: 'Strategy' },
  { id: 2, name: 'Ticket to Ride', players: '2–5', time: '30–60 min', category: 'Family' },
  { id: 3, name: 'Codenames', players: '4–8', time: '15 min', category: 'Party' },
  { id: 4, name: 'Carcassonne', players: '2–5', time: '35 min', category: 'Tile placement' },
  { id: 5, name: 'Azul', players: '2–4', time: '30–45 min', category: 'Abstract' },
  { id: 6, name: 'Wingspan', players: '1–5', time: '40–70 min', category: 'Engine building' },
]

export function GamesPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Games</Title>
      <Text c="dimmed">Browse the community game catalog — {games.length} games and counting.</Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {games.map((game) => (
          <Card key={game.id} withBorder padding="lg">
            <Group justify="space-between" mb="xs">
              <Text fw={600}>{game.name}</Text>
              <Badge variant="light">{game.category}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {game.players} players · {game.time}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
