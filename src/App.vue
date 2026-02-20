<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { initCloud, callFunction } from "@/utils/cloud";
import { userStore, setLoginResult, setUserInfo, restoreFromCache } from "@/store/user";

/** 无感登录：云开发模式下调用 login 云函数获取 openid + 用户信息 */
async function silentLogin() {
  // 防止重复调用
  if (userStore.isLogging) return;
  userStore.isLogging = true;

  try {
    const res = await callFunction<{
      code: number;
      data: {
        openid: string;
        nickName: string;
        avatarUrl: string;
        points: number;
        title: string;
        createTime: string;
        isNewUser: boolean;
      };
      message: string;
    }>("login");

    if (res.code === 0 && res.data) {
      setLoginResult(res.data.openid);
      setUserInfo({
        openid: res.data.openid,
        nickName: res.data.nickName,
        avatarUrl: res.data.avatarUrl,
        points: res.data.points,
        title: res.data.title,
        createTime: res.data.createTime,
      });
      console.log("[auth] 无感登录成功", res.data.isNewUser ? "(新用户)" : "(老用户)");
    } else {
      console.warn("[auth] 登录返回异常", res);
      userStore.isLogging = false;
    }
  } catch (err) {
    console.error("[auth] 无感登录失败", err);
    userStore.isLogging = false;
  }
}

onLaunch(() => {
  console.log("App Launch");

  // 1. 先从缓存恢复用户状态（秒开体验）
  restoreFromCache();

  // 2. 初始化云开发
  initCloud();

  // 3. 无感登录（后台静默执行，不阻塞页面渲染）
  silentLogin();
});

onShow(() => {
  console.log("App Show");
});

onHide(() => {
  console.log("App Hide");
});
</script>

<style>
/* 全局样式 */
page {
  background-color: #FFF6EB;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
</style>
