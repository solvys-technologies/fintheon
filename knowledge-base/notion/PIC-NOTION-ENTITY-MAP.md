<!-- [claude-code 2026-02-26] Notion entities used by Pulse boardroom/notion integration. -->

# PIC Notion — Entity Map (for Pulse)

This document records the canonical Notion pages/databases that make up the **Priced In Capital** operating system so Pulse can embed the right surface(s) and later integrate programmatically (Claude Co-Work is a separate effort).

## Primary pages

- **PIC root**: `https://www.notion.so/072f60d0f0ce44d49e4ba17145647b5d`
- **PIC Dashboard (recommended iframe default for Boardroom)**: `https://www.notion.so/d0b5029cf01f4a5d86932ea0c138d44f`
- **Zapier handoff spec (Harper Messages → SMS)**: `https://www.notion.so/5c6f3c463ee445028fa7ac21c3fca578`

## Core databases (URLs + Data Source IDs)

These appear under the PIC root page and are the core “project management + audit trail” layer.

- **Runs**
  - **DB URL**: `https://www.notion.so/c85f02cac79e459e84d97e9158536028`
  - **Data source**: `collection://c779653b-5f58-49ee-971e-6ea95df98822`
- **Decisions**
  - **DB URL**: `https://www.notion.so/91ac20c2c73146c3866a92e96a737711`
  - **Data source**: `collection://6da0b380-c360-4cf7-9219-610c23601dd6`
- **Trade Ideas**
  - **DB URL**: `https://www.notion.so/136fa9a2069e4afc835e0e139ead49f2`
  - **Data source**: `collection://3f48678a-f7fe-46f2-84cb-82e065b433c4`
- **Signals**
  - **DB URL**: `https://www.notion.so/5d33fce9e6e2-40f1-ad45-7f72a8459397`
  - **Data source**: `collection://e9ae4b83-fdff-48f6-95a7-a01984f95f3c`
- **Daily P&L**
  - **DB URL**: `https://www.notion.so/ee7d03052a424dcb95f6406c166e7584`
  - **Data source**: `collection://8bb2e951-3336-4561-ad32-18dc199f55ce`

## Alerting / Harper Messages database

This database is part of the existing PIC system for surfacing executive-facing messages and can be used by your automation stack (Zapier/Twilio, etc.).

- **Harper Messages**
  - **DB URL**: `https://www.notion.so/30c141b0da7d81ba8bb6e319a0c4c309`
  - **Data source**: `collection://30c141b0-da7d-8162-b035-000b181783c1`
  - **Notable source option**: `Harper-Kimi`

## Notes for Boardroom iframe

- Pulse will use `VITE_NOTION_BOARDROOM_URL` to decide what to embed in the Board Room tab.
- Default should be the **PIC Dashboard** URL above, but you can swap it to a dedicated “Boardroom Meeting” page when you finalize that page in Notion.

