"use client";

import { useEffect } from "react";

export default function LandingAnimations() {
  useEffect(() => {
    const revealItems = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const magneticItems = document.querySelectorAll<HTMLElement>("[data-magnetic]");
    const parallaxItems = document.querySelectorAll<HTMLElement>("[data-parallax]");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.classList.add("is-visible");
            observer.unobserve(target);
          }
        });
      },
      {
        threshold: 0.14,
        rootMargin: "0px 0px -60px 0px",
      }
    );

    revealItems.forEach((item) => observer.observe(item));

    const handlePointerMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;

      document.documentElement.style.setProperty("--mouse-x", x.toFixed(3));
      document.documentElement.style.setProperty("--mouse-y", y.toFixed(3));

      parallaxItems.forEach((item) => {
        const depth = Number(item.dataset.parallax || 1);
        item.style.transform = `translate3d(${x * depth * 10}px, ${y * depth * 10}px, 0)`;
      });
    };

    const magneticHandlers: Array<{
      element: HTMLElement;
      move: (event: PointerEvent) => void;
      leave: () => void;
    }> = [];

    magneticItems.forEach((element) => {
      const move = (event: PointerEvent) => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;

        element.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
      };

      const leave = () => {
        element.style.transform = "translate(0, 0)";
      };

      element.addEventListener("pointermove", move);
      element.addEventListener("pointerleave", leave);

      magneticHandlers.push({ element, move, leave });
    });

    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);

      magneticHandlers.forEach(({ element, move, leave }) => {
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", leave);
      });
    };
  }, []);

  return null;
}