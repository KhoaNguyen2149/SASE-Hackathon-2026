import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  setPersistence,
  browserSessionPersistence,
  reload,
  signOut,
} from "firebase/auth";
import { post } from "./client";
async function auth(config: FirebaseOptions) {
  const app =
    getApps().find((a) => a.name === "deskhop") ||
    initializeApp(config, "deskhop");
  const instance = getAuth(app);
  await setPersistence(instance, browserSessionPersistence);
  await instance.authStateReady();
  return instance;
}
export async function managedSignIn(
  config: FirebaseOptions,
  mode: "google" | "login" | "register",
  values: Record<string, FormDataEntryValue> = {},
) {
  const instance = await auth(config);
  const result =
    mode === "google"
      ? await signInWithPopup(instance, new GoogleAuthProvider())
      : mode === "register"
        ? await createUserWithEmailAndPassword(
            instance,
            String(values.email),
            String(values.password),
          )
        : await signInWithEmailAndPassword(
            instance,
            String(values.email),
            String(values.password),
          );
  if (mode === "register") {
    await updateProfile(result.user, { displayName: String(values.name) });
    await sendEmailVerification(result.user);
  }
  await post("auth/firebase", {
    idToken: await result.user.getIdToken(true),
    ...(mode === "register" ? { handle: String(values.handle) } : {}),
  });
  return { verified: result.user.emailVerified };
}
export async function managedReset(config: FirebaseOptions, email: string) {
  await sendPasswordResetEmail(await auth(config), email);
}
export async function managedVerification(
  config: FirebaseOptions,
  resend: boolean,
) {
  const instance = await auth(config);
  if (!instance.currentUser)
    throw new Error("Sign in again to manage verification.");
  if (resend) await sendEmailVerification(instance.currentUser);
  else {
    await reload(instance.currentUser);
    await post("auth/firebase", {
      idToken: await instance.currentUser.getIdToken(true),
    });
  }
}
export async function managedSignOut(config: FirebaseOptions) {
  await signOut(await auth(config));
}
