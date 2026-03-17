import { EmbedBuilder } from 'discord.js';
import { MarketSnapshot } from '../integrations/market-data';
import { config } from '../config';
import { riskEmoji } from './common';

/** Build a rich embed for volatility alerts */
export function buildAlertEmbed(snapshot: MarketSnapshot): EmbedBuilder {
  const emoji = riskEmoji[snapshot.riskAssessment] || '⚠️';
  const direction = snapshot.vixChange >= 0 ? '📈' : '📉';

  return new EmbedBuilder()
    .setColor(config.colors.red)
    .setTitle(`${emoji} Volatility Alert`)
    .setDescription(buildAlertDescription(snapshot))
    .addFields(
      { name: 'VIX', value: `${snapshot.vix.toFixed(2)} (${formatChange(snapshot.vixChange)})`, inline: true },
      { name: 'NQ Level', value: snapshot.nqLevel.toFixed(0), inline: true },
      { name: 'NQ Implied Move', value: `${snapshot.nqImpliedMove.toFixed(0)} pts`, inline: true },
      { name: 'Risk Level', value: `${emoji} ${snapshot.riskAssessment}`, inline: true },
    )
    .setFooter({ text: 'Harper-Perp · Fintheon · The Tape' })
    .setTimestamp();
}

/** Build a short alert description for the @everyone message */
export function buildAlertMessage(snapshot: MarketSnapshot): string {
  const emoji = snapshot.vixChange >= 0 ? '🔴' : '🟢';
  const direction = snapshot.vixChange >= 0 ? 'spike' : 'drop';
  return `${emoji} VIX ${direction} ${formatChange(snapshot.vixChange)} — NQ implied: ${snapshot.nqImpliedMove >= 0 ? '-' : '+'}${Math.abs(snapshot.nqImpliedMove).toFixed(0)}pts`;
}

function buildAlertDescription(snapshot: MarketSnapshot): string {
  if (snapshot.riskAssessment === 'EXTREME') {
    return '⚠️ **EXTREME volatility detected.** Risk-off conditions. Review all open positions.';
  }
  if (snapshot.riskAssessment === 'HIGH') {
    return '**High volatility regime.** Elevated risk — tighten stops, reduce size.';
  }
  return '**Volatility spike detected.** Monitor price action closely.';
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
