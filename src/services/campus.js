// Presentation helpers only. Future CampusIdentity / LostItemRegistry adapters
// can replace the local repository; this phase contains no blockchain connection.
export const campusService = {transactionLabel:'Local prototype record · saved in this browser'};
export const shortAddress = address => address?.length>18?`${address.slice(0,8)}…${address.slice(-4)}`:address;
