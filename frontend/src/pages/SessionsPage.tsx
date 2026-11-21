import { Stack, Table, Title } from '@mantine/core'

// Dummy data until the API exists.
const sessions = [
  { id: 1, title: 'Friday strategy night', game: 'Catan', date: '2026-12-04 19:00', spots: '2 / 4' },
  { id: 2, title: 'Party games at the café', game: 'Codenames', date: '2026-12-06 18:00', spots: '5 / 8' },
  { id: 3, title: 'Sunday afternoon trains', game: 'Ticket to Ride', date: '2026-12-08 15:00', spots: '3 / 5' },
]

export function SessionsPage() {
  return (
    <Stack gap="md">
      <Title order={2}>Upcoming sessions</Title>
      <Table.ScrollContainer minWidth={500}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Session</Table.Th>
              <Table.Th>Game</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Players</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sessions.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>{s.title}</Table.Td>
                <Table.Td>{s.game}</Table.Td>
                <Table.Td>{s.date}</Table.Td>
                <Table.Td>{s.spots}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  )
}
