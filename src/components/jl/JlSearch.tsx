import { Search } from "lucide-react";

export interface JlSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** div.jl-search > Search icon + input. */
export function JlSearch({ value, onChange, placeholder }: JlSearchProps) {
  return (
    <div className="jl-search">
      <Search />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export default JlSearch;
