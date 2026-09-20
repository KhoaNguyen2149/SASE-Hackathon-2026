export const avatarSize = 256;
// A profile picture travels inside the JSON request body, so it stays small.
export const maxAvatarDataUrl = 200000;
export const avatarTypes = ["image/jpeg", "image/png", "image/webp"];
export const avatarPattern =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export async function prepareAvatar(file: File): Promise<string> {
  if (!avatarTypes.includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error("That image is too large. Choose one under 12 MB.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = avatarSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the image.");
  // Cover the square, centred, so portraits and landscapes both crop sensibly.
  const scale = Math.max(avatarSize / bitmap.width, avatarSize / bitmap.height);
  const width = bitmap.width * scale,
    height = bitmap.height * scale;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, avatarSize, avatarSize);
  context.drawImage(
    bitmap,
    (avatarSize - width) / 2,
    (avatarSize - height) / 2,
    width,
    height,
  );
  bitmap.close();
  for (const quality of [0.82, 0.72, 0.62, 0.5, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= maxAvatarDataUrl) return url;
  }
  throw new Error("That image could not be made small enough. Try another.");
}
