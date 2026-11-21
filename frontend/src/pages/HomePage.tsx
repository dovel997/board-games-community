import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

export function HomePage() {
  return (
    <Stack gap="md" maw={640}>
      <Title order={1}>Find your next game night</Title>
      <Text c="dimmed">
        Meet board game players near you, organize sessions and keep track of the games you own and play.
      </Text>
      <Group>
        <Button component={Link} to="/sessions">
          Browse sessions
        </Button>
        <Button component={Link} to="/games" variant="default">
          Explore games
        </Button>
      </Group>
    </Stack>
  )
}
