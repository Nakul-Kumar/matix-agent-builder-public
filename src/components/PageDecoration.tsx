export function PageDecoration() {
  return (
    <div className="pageDecoration" aria-hidden="true">
      <div className="pageDecoShapes">
        <svg
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          <defs>
            <filter
              id="pageDecoTexture"
              x="-5%"
              y="-5%"
              width="110%"
              height="110%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.02"
                numOctaves={2}
                seed={5}
              />
              <feDisplacementMap in="SourceGraphic" scale={4} />
            </filter>
          </defs>
          <g filter="url(#pageDecoTexture)">
            <path
              className="pageDecoShape pageDecoA"
              d="M -100 80 C -50 -60, 100 -100, 250 -80 C 380 -60, 480 30, 450 130 C 430 200, 380 250, 300 280 C 220 290, 130 270, 60 240 C -10 200, -80 160, -100 80 Z"
              fill="#9E8E70"
              opacity="0.32"
            />
            <path
              className="pageDecoShape pageDecoB"
              d="M 1150 -50 C 1280 -80, 1420 -40, 1500 30 C 1580 80, 1700 120, 1650 220 C 1610 300, 1450 280, 1330 250 C 1240 220, 1180 160, 1130 100 C 1100 50, 1110 0, 1150 -50 Z"
              fill="#B89684"
              opacity="0.30"
            />
            <path
              className="pageDecoShape pageDecoC"
              d="M -50 380 C 30 360, 120 370, 180 410 C 220 440, 230 480, 200 520 C 170 555, 90 565, 30 540 C -30 520, -60 480, -50 440 C -60 420, -55 400, -50 380 Z"
              fill="#7F9474"
              opacity="0.22"
            />
            <path
              className="pageDecoShape pageDecoD"
              d="M 1180 700 C 1280 660, 1420 660, 1500 700 C 1580 730, 1680 760, 1700 820 C 1700 880, 1620 940, 1500 960 C 1380 980, 1250 970, 1180 920 C 1120 870, 1100 800, 1130 760 C 1140 730, 1160 710, 1180 700 Z"
              fill="#C5A580"
              opacity="0.32"
            />
            <path
              className="pageDecoShape pageDecoE"
              d="M -50 720 C 50 680, 180 670, 280 700 C 360 730, 420 800, 380 860 C 340 920, 220 940, 100 920 C 0 900, -80 860, -100 800 C -100 760, -80 730, -50 720 Z"
              fill="#8A7565"
              opacity="0.30"
            />
            <path
              className="pageDecoShape pageDecoF"
              d="M 820 40 C 850 20, 900 15, 940 30 C 970 45, 985 70, 970 95 C 955 115, 920 125, 880 120 C 840 115, 815 100, 810 80 C 805 65, 810 50, 820 40 Z"
              fill="#9E8E70"
              opacity="0.18"
            />
          </g>
        </svg>
      </div>
      <div className="pageDecoLines">
        <svg
          viewBox="0 0 1600 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
          width="100%"
          height="100%"
        >
          <g fill="none" stroke="#A24A26" strokeWidth={2} opacity="0.55">
            <path
              className="pageDecoLine pageDecoLine1"
              d="M 1500 50 C 1300 200, 1100 350, 800 400 C 500 450, 200 550, -50 600"
            />
            <path
              className="pageDecoLine pageDecoLine2"
              d="M -50 120 C 200 60, 600 90, 880 100 C 1180 110, 1400 180, 1700 100"
            />
            <path
              className="pageDecoLine pageDecoLine3"
              d="M 100 780 C 150 750, 220 770, 240 820 C 250 850, 230 880, 200 870"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
