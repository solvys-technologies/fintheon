import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";

interface FuturesChartProps {
    symbol?: string;
    className?: string;
}

export function FuturesChart({ symbol = "CME_MINI:ES1!", className = "" }: FuturesChartProps) {
    return (
        <div className={`w-full h-[400px] rounded-xl overflow-hidden border border-white/10 ${className}`}>
            <AdvancedRealTimeChart
                symbol={symbol}
                theme="dark"
                autosize
                interval="15"
                timezone="America/New_York"
                style="1"
                locale="en"
                toolbar_bg="#000000"
                enable_publishing={false}
                hide_side_toolbar={false}
                allow_symbol_change={true}
                // Custom colors to match Pulse
                // @ts-ignore
                overrides={{
                    "paneProperties.background": "#000000",
                    "paneProperties.vertGridProperties.color": "rgba(255, 255, 255, 0.05)",
                    "paneProperties.horzGridProperties.color": "rgba(255, 255, 255, 0.05)",
                    "scalesProperties.textColor": "#AAA",
                    "mainSeriesProperties.candleStyle.upColor": "#4ade80",
                    "mainSeriesProperties.candleStyle.downColor": "#ef4444",
                    "mainSeriesProperties.candleStyle.drawWick": true,
                    "mainSeriesProperties.candleStyle.wickUpColor": "#4ade80",
                    "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
                }}
                copyrightStyles={{
                    parent: {
                        display: "none"
                    }
                }}
            />
        </div>
    );
}
