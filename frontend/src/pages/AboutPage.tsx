import { Stack, Text, Title } from '@mantine/core'

export function AboutPage() {
  return (
    <Stack gap="md" maw={640}>
      <Title order={2}>About</Title>
      <Text>
        Board Games Community is a place for players to find each other, organize game nights and share their love of
        board games.
      </Text>
    </Stack>
  )
}
