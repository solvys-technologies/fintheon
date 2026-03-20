import { EconomicCalendar as TVEconomicCalendar } from "react-ts-tradingview-widgets";

interface EconomicCalendarProps {
    className?: string;
}

export function EconomicCalendar({ className = "" }: EconomicCalendarProps) {
    return (
        <div className={`w-full h-[600px] rounded-xl overflow-hidden border border-white/10 ${className}`}>
            <TVEconomicCalendar
                colorTheme="dark"
                autosize
                locale="en"
                // @ts-ignore
                currencyFilter="USD"
                importanceFilter="-1,0,1"
                // @ts-ignore
                overrides={{
                    "paneProperties.background": "#000000",
                }}
            />
        </div>
    );
}
