import { Response } from 'express';
import { z } from 'zod';
import { supabase } from '../config/database.js';
import { totpService } from '../services/totp.service.js';
import { auditService } from '../services/audit.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const enable2FASchema = z.object({
  code: z.string().length(6),
});

export const auth2faSelfController = {
  /**
   * POST /api/auth/2fa/setup
   * Пользователь генерирует себе QR-код для настройки 2FA
   */
  async setup2FA(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('two_factor_enabled')
        .eq('id', req.user.id)
        .single();

      if (fetchError || !profile) {
        res.status(404).json({ success: false, error: 'Профиль не найден' });
        return;
      }

      if (profile.two_factor_enabled) {
        res.status(400).json({ success: false, error: '2FA уже включена' });
        return;
      }

      const { data: authUser } = await supabase.auth.admin.getUserById(req.user.id);

      if (!authUser?.user?.email) {
        res.status(400).json({ success: false, error: 'Email пользователя не найден' });
        return;
      }

      const { secret, encryptedSecret } = totpService.generateSecret(authUser.user.email);
      const qrCode = await totpService.generateQRCode(authUser.user.email, secret);

      // Сохраняем секрет, но НЕ включаем 2FA — ждём подтверждения кодом
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ totp_secret: encryptedSecret })
        .eq('id', req.user.id);

      if (updateError) {
        console.error('Setup 2FA error:', updateError);
        res.status(500).json({ success: false, error: 'Не удалось сохранить настройки 2FA' });
        return;
      }

      res.json({ success: true, secret, qrCode });
    } catch (error) {
      console.error('Setup 2FA error:', error);
      res.status(500).json({ success: false, error: 'Ошибка настройки 2FA' });
    }
  },

  /**
   * POST /api/auth/2fa/enable
   * Пользователь подтверждает 2FA вводом кода из приложения
   */
  async enable2FA(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { code } = enable2FASchema.parse(req.body);

      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('totp_secret, two_factor_enabled')
        .eq('id', req.user.id)
        .single();

      if (fetchError || !profile) {
        res.status(404).json({ success: false, error: 'Профиль не найден' });
        return;
      }

      if (profile.two_factor_enabled) {
        res.status(400).json({ success: false, error: '2FA уже включена' });
        return;
      }

      if (!profile.totp_secret) {
        res.status(400).json({ success: false, error: 'Сначала выполните настройку 2FA' });
        return;
      }

      const isValid = totpService.verifyToken(profile.totp_secret, code);

      if (!isValid) {
        res.status(400).json({ success: false, error: 'Неверный код подтверждения' });
        return;
      }

      const { codes, encryptedCodes } = totpService.generateRecoveryCodes();

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          two_factor_enabled: true,
          recovery_codes: encryptedCodes,
        })
        .eq('id', req.user.id);

      if (updateError) {
        console.error('Enable 2FA error:', updateError);
        res.status(500).json({ success: false, error: 'Не удалось включить 2FA' });
        return;
      }

      await auditService.logFromRequest(req, req.user.id, '2FA_ENABLED', {
        entityType: 'user',
        entityId: req.user.id,
      });

      res.json({
        success: true,
        recoveryCodes: codes.map(totpService.formatRecoveryCode),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }
      console.error('Enable 2FA error:', error);
      res.status(500).json({ success: false, error: 'Ошибка включения 2FA' });
    }
  },

  /**
   * POST /api/auth/2fa/disable
   * Пользователь отключает свою 2FA
   */
  async disable2FA(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          totp_secret: null,
          recovery_codes: null,
          two_factor_enabled: false,
        })
        .eq('id', req.user.id);

      if (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({ success: false, error: 'Не удалось отключить 2FA' });
        return;
      }

      await auditService.logFromRequest(req, req.user.id, '2FA_DISABLED', {
        entityType: 'user',
        entityId: req.user.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Disable 2FA error:', error);
      res.status(500).json({ success: false, error: 'Ошибка отключения 2FA' });
    }
  },
};
