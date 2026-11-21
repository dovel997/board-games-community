import { Button, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <Stack gap="md" align="flex-start">
      <Title order={2}>Page not found</Title>
      <Text c="dimmed">The page you're looking for doesn't exist.</Text>
      <Button component={Link} to="/" variant="default">
        Back to home
      </Button>
    </Stack>
  )
}
