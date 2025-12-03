// 這是未來您在 React 中需要替換的 Service 範例
const GasService = {
  getOrders: () => {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getOrders();
    });
  },
  createOrders: (orders, orderNo) => {
    return new Promise((resolve, reject) => {
      // @ts-ignore
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .createOrders(JSON.stringify(orders), orderNo); // 轉成字串傳送較安全
    });
  },
  // ... 其他所有方法都要這樣包裝
};