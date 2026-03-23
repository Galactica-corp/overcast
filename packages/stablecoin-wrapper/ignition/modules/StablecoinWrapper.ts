import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("StablecoinWrapperModule", (m) => {
  const underlyingToken = m.getParameter("underlyingToken");
  const stablecoinWrapper = m.contract("StablecoinWrapper");

  m.call(stablecoinWrapper, "initialize", [underlyingToken]);

  return { stablecoinWrapper };
});
