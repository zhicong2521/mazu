export interface FormattedAuthError {
  code: string;
  message: string;
  suggestNewTab: boolean;
  suggestRedirect: boolean;
}

/**
 * Extracts Firebase Auth error code from an unknown thrown error.
 */
export function extractAuthErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string') {
    return (error as { code: string }).code;
  }
  const text = error instanceof Error ? error.message : String(error ?? '');
  const match = text.match(/auth\/[a-z0-9-]+/i);
  return match ? match[0].toLowerCase() : 'auth/unknown';
}

/**
 * Maps Firebase Auth errors into actionable, user-facing guidance tailored to
 * iframe preview environments vs top-level browser tabs.
 */
export function formatFirebaseAuthError(
  error: unknown,
  isInIframe: boolean,
  hostname = '',
): FormattedAuthError {
  const code = extractAuthErrorCode(error);

  if (code === 'auth/popup-blocked') {
    return {
      code,
      message: isInIframe
        ? '瀏覽器在預覽框內封鎖了 Google 登入彈窗。請點擊下方「在新分頁開啟登入」即可順利完成登入！'
        : '瀏覽器封鎖了登入彈出視窗，請允許彈窗，或改點下方「跳轉方式登入」。',
      suggestNewTab: isInIframe,
      suggestRedirect: !isInIframe,
    };
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      message: isInIframe
        ? '登入視窗已關閉或被預覽框阻擋。若未看到 Google 登入畫面，請點下方「在新分頁開啟登入」。'
        : '您已關閉 Google 登入視窗，可隨時重新點擊登入。',
      suggestNewTab: isInIframe,
      suggestRedirect: false,
    };
  }

  if (code === 'auth/unauthorized-domain') {
    const hostNote = hostname ? `（目前網域：${hostname}）` : '';
    return {
      code,
      message: `目前網址尚未加入 Firebase 授權網域${hostNote}。請改用分享連結開啟，或在 Firebase Console 的 Authentication → Settings → Authorized domains 加入此網域。`,
      suggestNewTab: isInIframe,
      suggestRedirect: false,
    };
  }

  if (
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/web-storage-unsupported'
  ) {
    return {
      code,
      message: isInIframe
        ? '目前預覽框封鎖了第三方 Cookie／儲存空間，無法完成內嵌登入。請點下方「在新分頁開啟登入」！'
        : '目前瀏覽器環境封鎖了儲存空間或彈窗，請關閉無痕限制或改用 Chrome / Safari 開啟。',
      suggestNewTab: true,
      suggestRedirect: !isInIframe,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      message: '無法連線至 Google 登入伺服器，請確認網路可正常存取 Google 服務後重試。',
      suggestNewTab: false,
      suggestRedirect: false,
    };
  }

  if (code === 'auth/internal-error') {
    return {
      code,
      message: isInIframe
        ? '內嵌預覽環境無法完成 Google 彈窗驗證，請點擊下方「在新分頁開啟登入」即可正常登入！'
        : 'Google 登入服務回傳暫時性錯誤，請重試或改用「跳轉方式登入」。',
      suggestNewTab: isInIframe,
      suggestRedirect: !isInIframe,
    };
  }

  return {
    code,
    message: isInIframe
      ? `Google 登入未完成（${code}）。建議點下方「在新分頁開啟登入」避開預覽框限制。`
      : `Google 登入失敗（${code}），請確認網路可連線 Google 或重試。`,
    suggestNewTab: isInIframe,
    suggestRedirect: !isInIframe,
  };
}
