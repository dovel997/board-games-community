# Features

> Status: **Draft**. Priorities: **Must** (MVP), **Should** (soon after MVP), **Could** (later).
> Technical details live in [technical.md](technical.md).

## Overview

A web platform where board game players can find each other, organize game nights, track the games they own and play, and talk about board games.

### Goals

- Make it easy to find people to play with nearby.
- Make it easy to organize and join game sessions.
- Give players a place to keep their collection and play history.

### User roles

| Role | Description |
|------|-------------|
| Guest | Not logged in; can browse public content |
| Player | Registered user; can join sessions, manage a collection, comment |
| Host | A player who creates sessions (any player can host) |
| Moderator | Handles reports and removes content |
| Admin | Full access, manages the game catalog and users |

---

## 1. Accounts & Profiles

| ID | Requirement | Priority |
|----|-------------|----------|
| F-1.1 | Register with email and password, with email confirmation | Must |
| F-1.2 | Log in, log out, reset a forgotten password | Must |
| F-1.3 | Profile: display name, avatar, city/area, short bio | Must |
| F-1.4 | Favourite games and preferred game types on profile | Should |
| F-1.5 | Privacy settings for profile and collection visibility | Should |
| F-1.6 | Delete own account and data | Must |
| F-1.7 | Sign in with external providers (Google, etc.) | Could |

## 2. Game Catalog

| ID | Requirement | Priority |
|----|-------------|----------|
| F-2.1 | Browse and search games by name, player count, play time, age, category | Must |
| F-2.2 | Game detail page with description, image and stats | Must |
| F-2.3 | Rate and review games | Should |
| F-2.4 | Import game data from an external source | Could |

## 3. Personal Collection

| ID | Requirement | Priority |
|----|-------------|----------|
| F-3.1 | Mark games as **owned**, **wishlist** or **want to play** | Must |
| F-3.2 | View other users' collections (respecting privacy settings) | Should |
| F-3.3 | Mark owned games as available to lend or trade | Could |

## 4. Game Sessions

| ID | Requirement | Priority |
|----|-------------|----------|
| F-4.1 | Create a session: title, date/time, location, game(s), max players | Must |
| F-4.2 | Browse upcoming sessions, filtered by area, date and game | Must |
| F-4.3 | Join or leave a session; host sees the attendee list | Must |
| F-4.4 | Host can edit or cancel a session; attendees are notified | Must |
| F-4.5 | Public or invite-only sessions | Should |
| F-4.6 | Log results after a session (winner, scores) to build play history | Should |
| F-4.7 | Waitlist when a session is full | Could |

## 5. Groups

| ID | Requirement | Priority |
|----|-------------|----------|
| F-5.1 | Create and join groups (e.g. a local club) | Should |
| F-5.2 | Groups have members, admins and their own sessions | Should |

## 6. Communication

| ID | Requirement | Priority |
|----|-------------|----------|
| F-6.1 | Comments on sessions | Must |
| F-6.2 | Discussion threads per game and per group | Should |
| F-6.3 | In-app notifications (invites, session changes, replies) | Should |
| F-6.4 | Email notifications (opt-in) | Could |
| F-6.5 | Direct messages between users | Could |

## 7. Moderation & Admin

| ID | Requirement | Priority |
|----|-------------|----------|
| F-7.1 | Admins manage the game catalog | Must |
| F-7.2 | Users can report content or other users | Should |
| F-7.3 | Moderators can remove content; admins can suspend users | Should |

## Open questions

- Single city/region at launch, or worldwide?
- Where game catalog data comes from (manual entry vs. external import)?
- Which UI languages?
- Mobile app later, or web only?
