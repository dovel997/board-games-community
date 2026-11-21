import {
  ActionIcon,
  AppShell,
  Burger,
  Group,
  NavLink,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { NavLink as RouterNavLink, Outlet } from 'react-router'

const links = [
  { to: '/', label: 'Home' },
  { to: '/games', label: 'Games' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/about', label: 'About' },
]

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure()
  const { setColorScheme } = useMantineColorScheme()
  const colorScheme = useComputedColorScheme('light')

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap" miw={0}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <Title order={3} size="h4" lineClamp={1}>
              Board Games Community
            </Title>
          </Group>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Toggle color scheme"
            onClick={() => setColorScheme(colorScheme === 'dark' ? 'light' : 'dark')}
          >
            {colorScheme === 'dark' ? '☀' : '☾'}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {links.map((link) => (
          <RouterNavLink key={link.to} to={link.to} end={link.to === '/'} style={{ textDecoration: 'none', color: 'inherit' }} onClick={close}>
            {({ isActive }) => <NavLink component="span" label={link.label} active={isActive} />}
          </RouterNavLink>
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
