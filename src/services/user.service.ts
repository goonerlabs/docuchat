import { AppError } from "../lib/errors.js";
import { userRepository } from "../repositories/user.repository.js";

export async function getProfile(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user || user.deletedAt) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tier: user.tier,
    createdAt: user.createdAt,
  };
}

export async function listUsers() {
  return userRepository.listActive();
}
