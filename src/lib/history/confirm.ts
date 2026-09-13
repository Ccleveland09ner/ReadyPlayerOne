/**
 * The word that arms Clear Quiz History.
 *
 * Its own module because it is needed on both sides -- the form renders it in
 * the placeholder and the server action re-checks it -- and a `"use server"`
 * file may export nothing but async functions, so it cannot live there.
 */
export const CLEAR_CONFIRMATION = "DELETE";
