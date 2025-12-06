import { Response } from "express";
import { AuthRequest } from "../../types";
import { UsersService } from "./users.service";

const usersService = new UsersService();

export class UsersController {
  async selfVerify(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await usersService.selfVerifyStudent(
        req.user!.userId,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyStudentProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await usersService.getStudentProfile(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyManagerProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await usersService.getManagerProfile(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async updateManagerProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await usersService.updateManagerProfile(
        req.user!.userId,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAllUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const role = req.query.role as string | undefined;
      const result = await usersService.getAllUsers(role);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async terminateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await usersService.terminateUser(
        req.params.id,
        req.user!.userId
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteMyAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await usersService.deleteMyAccount(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
