// Cache tag constants — kept in a non-"use server" file so they can be
// exported as plain values (not async functions).

export const MISSIONS_TAG = "missions-list"
export const MISSION_DETAIL_TAG = (id: string) => `mission:${id}`

export const ETUDES_TAG = "etudes"
export const ETUDE_DETAIL_TAG = (id: string) => `etude:${id}`

export const CANDIDATURES_TAG = (userId: string) => `candidatures:${userId}`

export const CLIENTS_TAG = "clients"
export const MEMBERS_TAG = "members"
export const PARAMETRES_TAG = "parametres"

export const USER_PROFILE_TAG = (userId: string) => `user-profile:${userId}`

export const FACTURES_TAG = "factures"
export const TRESORERIE_TAG = "tresorerie"

export const PROPOSALS_TAG = "proposals"
