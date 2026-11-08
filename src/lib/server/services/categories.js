import "server-only";
import { col, newId } from "../mongodb";
import { ApiError } from "../api";
import { CATEGORY_TYPES, COLORS, oneOf, publicDoc, str } from "../validate";

export async function createCategory(userId, body) {
  const name = str(body.name, "name", { max: 40 });
  const type = oneOf(body.type, "type", CATEGORY_TYPES);
  const icon = str(body.icon ?? "tag", "icon", { max: 40 });
  const color = oneOf(body.color ?? "gray", "color", COLORS);

  const last = await col("categories")
    .find({ userId })
    .sort({ sortOrder: -1 })
    .limit(1)
    .next();
  const now = new Date();
  const doc = {
    _id: newId(),
    userId,
    name,
    type,
    icon,
    color,
    parentId: null, // categories are flat: no subcategories
    sortOrder: (last?.sortOrder ?? -1) + 1,
    useCount: 0,
    lastUsedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await col("categories").insertOne(doc);
  return publicDoc(doc);
}

export async function updateCategory(userId, categoryId, body) {
  const categories = col("categories");
  if (body.deleted === false) {
    const r = await categories.updateMany(
      {
        userId,
        deletedAt: { $ne: null },
        $or: [{ _id: categoryId }, { parentId: categoryId }],
      },
      { $set: { deletedAt: null, updatedAt: new Date() } },
    );
    if (!r.matchedCount)
      throw new ApiError(404, "Category not found", "not_found");
    return { ok: true };
  }
  const set = { updatedAt: new Date() };
  if (body.name !== undefined) set.name = str(body.name, "name", { max: 40 });
  if (body.icon !== undefined) set.icon = str(body.icon, "icon", { max: 40 });
  if (body.color !== undefined) set.color = oneOf(body.color, "color", COLORS);
  const r = await categories.findOneAndUpdate(
    { _id: categoryId, userId, deletedAt: null },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!r) throw new ApiError(404, "Category not found", "not_found");
  return publicDoc(r);
}

/** Soft delete; existing transactions keep their reference and still render. */
export async function deleteCategory(userId, categoryId) {
  const now = new Date();
  const r = await col("categories").updateMany(
    {
      userId,
      deletedAt: null,
      $or: [{ _id: categoryId }, { parentId: categoryId }],
    },
    { $set: { deletedAt: now, updatedAt: now } },
  );
  if (!r.matchedCount)
    throw new ApiError(404, "Category not found", "not_found");
  return { ok: true };
}
