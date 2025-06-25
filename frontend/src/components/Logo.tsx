export const Logo = () => {
  return (
    <div className="font-normal flex space-x-2 items-center text-sm py-1 relative z-20">
      <div className="h-5 w-6 bg-gradient-to-r from-primary to-purple-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 animate-glow" />
      <div className="flex flex-col">
        <span className="font-bold text-lg text-gradient">LightLink</span>
      </div>
    </div>
  );
};

export const LogoIcon = () => {
  return (
    <div className="h-5 w-6 bg-gradient-to-r from-primary to-purple-500 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 animate-glow" />
  );
}; 